import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  AnalysisLine,
  AnalysisRequest,
  EngineCompleteEvent,
  EngineInfoEvent,
  EngineStatus,
} from "../types";
import { getCachedAnalysis, putCachedAnalysis } from "./storage";

type PendingJob = {
  lines: Map<number, AnalysisLine>;
  onInfo?: (lines: AnalysisLine[]) => void;
  resolve: (result: EngineCompleteEvent) => void;
  reject: (error: Error) => void;
};

type EarlyJob = {
  lines: Map<number, AnalysisLine>;
  complete?: EngineCompleteEvent;
  error?: Error;
};

const pending = new Map<string, PendingJob>();
const earlyJobs = new Map<string, EarlyJob>();
let unlisteners: UnlistenFn[] = [];
let listenersReady: Promise<void> | null = null;

function sortedLines(lines: Map<number, AnalysisLine>): AnalysisLine[] {
  return [...lines.values()].sort((a, b) => a.rank - b.rank);
}

function earlyJob(jobId: string): EarlyJob {
  let job = earlyJobs.get(jobId);
  if (!job) {
    job = { lines: new Map() };
    earlyJobs.set(jobId, job);
    window.setTimeout(() => earlyJobs.delete(jobId), 30_000);
  }
  return job;
}

async function ensureListeners(): Promise<void> {
  if (listenersReady) return listenersReady;
  listenersReady = (async () => {
    unlisteners.push(
      await listen<EngineInfoEvent>("engine:info", ({ payload }) => {
        const job = pending.get(payload.jobId);
        if (!job) {
          earlyJob(payload.jobId).lines.set(payload.line.rank, payload.line);
          return;
        }
        job.lines.set(payload.line.rank, payload.line);
        job.onInfo?.(sortedLines(job.lines));
      }),
      await listen<EngineCompleteEvent>("engine:complete", ({ payload }) => {
        const job = pending.get(payload.jobId);
        if (!job) {
          earlyJob(payload.jobId).complete = payload;
          return;
        }
        pending.delete(payload.jobId);
        job.resolve({ ...payload, lines: payload.lines.length ? payload.lines : sortedLines(job.lines) });
      }),
      await listen<{ jobId: string | null; message: string }>("engine:error", ({ payload }) => {
        if (payload.jobId) {
          const job = pending.get(payload.jobId);
          if (!job) {
            earlyJob(payload.jobId).error = new Error(payload.message);
            return;
          }
          pending.delete(payload.jobId);
          job.reject(new Error(payload.message));
        }
      }),
    );
  })();
  return listenersReady;
}

export async function initializeEngine(): Promise<EngineStatus> {
  if (!isTauri()) {
    return {
      state: "stopped",
      engineName: null,
      currentJobId: null,
      message: "Engine runs in the desktop build.",
    };
  }
  await ensureListeners();
  return invoke<EngineStatus>("engine_initialize");
}

export async function getEngineStatus(): Promise<EngineStatus> {
  if (!isTauri()) return initializeEngine();
  return invoke<EngineStatus>("engine_get_status");
}

export async function restartEngine(): Promise<EngineStatus> {
  if (!isTauri()) return initializeEngine();
  await ensureListeners();
  return invoke<EngineStatus>("engine_restart");
}

export async function analyzePosition(
  request: AnalysisRequest,
  onInfo?: (lines: AnalysisLine[]) => void,
): Promise<EngineCompleteEvent> {
  if (!isTauri()) throw new Error("Stockfish is available in the Tauri desktop build.");
  const cached = await getCachedAnalysis(request);
  if (cached) {
    onInfo?.(cached);
    return { jobId: `cache-${crypto.randomUUID()}`, bestMove: cached[0]?.pvUci[0] ?? null, lines: cached };
  }
  await ensureListeners();
  const jobId = await invoke<string>("engine_analyze", { request });
  return new Promise((resolve, reject) => {
    const job: PendingJob = {
      lines: new Map(),
      onInfo,
      resolve: (result) => { void putCachedAnalysis(request, result.lines); resolve(result); },
      reject,
    };
    pending.set(jobId, job);
    const early = earlyJobs.get(jobId);
    if (!early) return;
    earlyJobs.delete(jobId);
    for (const [rank, line] of early.lines) job.lines.set(rank, line);
    if (job.lines.size) job.onInfo?.(sortedLines(job.lines));
    if (early.error) {
      pending.delete(jobId);
      job.reject(early.error);
    } else if (early.complete) {
      pending.delete(jobId);
      job.resolve({
        ...early.complete,
        lines: early.complete.lines.length ? early.complete.lines : sortedLines(job.lines),
      });
    }
  });
}

export async function stopAnalysis(jobId?: string): Promise<void> {
  if (!isTauri()) return;
  await invoke("engine_stop", { jobId: jobId ?? null });
}

export function disposeEngineListeners(): void {
  for (const unlisten of unlisteners) unlisten();
  unlisteners = [];
  listenersReady = null;
}
