import { useState } from "react";
import type { AnalysisLine, CoachInsight, EngineProfileName, EngineSettings, EngineStatus } from "../types";

const DEFAULT_SETTINGS: EngineSettings = { threads: 2, hashMb: 128, multiPv: 3, depth: 0 };

interface AnalysisPanelProps {
  status: EngineStatus;
  lines: AnalysisLine[];
  insight: CoachInsight | null;
  activeProfile: EngineProfileName;
  onDeepen: (timeMs: number, settings: EngineSettings) => void;
  onPlayMove: (uci: string) => void;
  onRestart: () => void;
  onMakeCard: () => void;
  canMakeCard: boolean;
}

function score(line: AnalysisLine): string {
  if (line.mateIn !== null) return `M${line.mateIn}`;
  return `${(line.scoreCp ?? 0) >= 0 ? "+" : ""}${((line.scoreCp ?? 0) / 100).toFixed(2)}`;
}

function moveLabel(uci: string): string {
  return uci ? `${uci.slice(0, 2)}→${uci.slice(2, 4)}${uci[4] ? `=${uci[4].toUpperCase()}` : ""}` : "—";
}

export function AnalysisPanel({
  status, lines, insight, activeProfile, onDeepen, onPlayMove, onRestart, onMakeCard, canMakeCard,
}: AnalysisPanelProps) {
  const [settings, setSettings] = useState<EngineSettings>(DEFAULT_SETTINGS);

  function updateSetting(key: keyof EngineSettings, value: string): void {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    setSettings((current) => ({ ...current, [key]: parsed }));
  }

  return (
    <aside className="analysis-panel" aria-label="Engine analysis">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">LOCAL ENGINE</span>
          <h2>{status.engineName || "Stockfish 18"}</h2>
        </div>
        <span className={`engine-state state-${status.state}`}>{status.state}</span>
      </div>

      <div className="depth-controls" aria-label="Analysis depth">
        <button type="button" className={activeProfile === "quick" ? "is-active" : ""} onClick={() => onDeepen(1_000, settings)}>Quick</button>
        <button type="button" onClick={() => onDeepen(5_000, settings)}>5s</button>
        <button type="button" className={activeProfile === "deep" ? "is-active" : ""} onClick={() => onDeepen(15_000, settings)}>15s</button>
        <button type="button" onClick={() => onDeepen(60_000, settings)}>60s</button>
      </div>

      <details className="engine-settings">
        <summary>Engine settings <span>THREADS · HASH · MULTIPV · DEPTH</span></summary>
        <div className="engine-settings-grid">
          <label>Threads<input type="number" min="1" max="16" step="1" value={settings.threads} onChange={(event) => updateSetting("threads", event.target.value)} /></label>
          <label>Hash (MiB)<input type="number" min="16" max="4096" step="16" value={settings.hashMb} onChange={(event) => updateSetting("hashMb", event.target.value)} /></label>
          <label>MultiPV<input type="number" min="1" max="5" step="1" value={settings.multiPv} onChange={(event) => updateSetting("multiPv", event.target.value)} /></label>
          <label>Fixed depth<input type="number" min="0" max="99" step="1" value={settings.depth} onChange={(event) => updateSetting("depth", event.target.value)} /></label>
        </div>
        <p>Depth 0 uses the selected time. Higher values search deeper and may take longer.</p>
        <button type="button" className="settings-apply" onClick={() => onDeepen(1_000, settings)}>Analyze with these settings</button>
      </details>

      {status.message && status.state !== "ready" && status.state !== "thinking" && (
        <div className="engine-notice">{status.message}<button type="button" onClick={onRestart}>Restart engine</button></div>
      )}

      <div className="variation-list">
        {lines.length === 0 ? (
          <div className="empty-analysis">
            <span>NO LINE YET</span>
            <p>Move a piece or start a deeper search.</p>
          </div>
        ) : lines.map((line) => (
          <article className="variation" key={line.rank}>
            <div className="variation-rank">0{line.rank}</div>
            <div className="variation-main">
              <div className="variation-topline">
                <strong>{moveLabel(line.pvUci[0])}</strong>
                <span className="score">{score(line)}</span>
              </div>
              <p>{line.pvUci.slice(0, 8).map(moveLabel).join("  ")}</p>
              <div className="variation-meta">
                <small>D{line.depth} · {Math.round(line.nodes / 1000)}K nodes · {Math.round(line.nps / 1000)}K n/s</small>
                {line.pvUci[0] && <button type="button" onClick={() => onPlayMove(line.pvUci[0])}>Play move</button>}
              </div>
            </div>
          </article>
        ))}
      </div>

      <section className="coach-block" aria-live="polite">
        <span className="eyebrow">VERIFIABLE NOTE</span>
        <h3>{insight?.motif || "WAITING FOR EVIDENCE"}</h3>
        <p>{insight?.message || "POSITION ZERO only explains patterns it can verify from the board and principal variation."}</p>
        {insight && <small>confidence {Math.round(insight.confidence * 100)}%</small>}
      </section>

      <button type="button" className="primary-action" onClick={onMakeCard} disabled={!canMakeCard}>
        Make training card
      </button>
    </aside>
  );
}
