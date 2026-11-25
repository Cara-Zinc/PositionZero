import { isTauri } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";
import type { AnalysisLine, AnalysisRequest, ReviewGrade, Study, TrainingCard } from "../types";
import { scheduleReview } from "./srs";

const STUDIES_KEY = "position-zero.studies";
const CARDS_KEY = "position-zero.cards";
let dbPromise: Promise<Database> | null = null;
const memoryAnalysisCache = new Map<string, AnalysisLine[]>();
const ENGINE_FINGERPRINT = "stockfish-18-cb3d4ee-apple-silicon";
const CACHE_SOFT_LIMIT = 256 * 1024 * 1024;

function db(): Promise<Database> {
  dbPromise ??= Database.load("sqlite:position-zero.db");
  return dbPromise;
}

function readLocal<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]") as T[];
  } catch {
    return [];
  }
}

function writeLocal<T>(key: string, values: T[]): void {
  localStorage.setItem(key, JSON.stringify(values));
}

function rowToStudy(row: Record<string, unknown>): Study {
  return {
    id: String(row.id),
    cardNumber: Number(row.card_number),
    title: String(row.title),
    sourceType: row.source_type as Study["sourceType"],
    sourceGameId: row.source_game_id ? String(row.source_game_id) : null,
    accountId: row.account_id ? String(row.account_id) : null,
    rootFen: String(row.root_fen),
    currentFen: String(row.current_fen),
    originalPgn: row.original_pgn ? String(row.original_pgn) : null,
    moveTree: JSON.parse(String(row.move_tree || "[]")),
    notes: String(row.notes || ""),
    tags: JSON.parse(String(row.tags || "[]")),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function rowToCard(row: Record<string, unknown>): TrainingCard {
  return {
    id: String(row.id),
    studyId: String(row.study_id),
    promptFen: String(row.prompt_fen),
    acceptedMoves: JSON.parse(String(row.accepted_moves || "[]")),
    forcingLine: JSON.parse(String(row.forcing_line || "[]")),
    motifTags: JSON.parse(String(row.motif_tags || "[]")),
    dueAt: String(row.due_at),
    intervalDays: Number(row.interval_days),
    lapses: Number(row.lapses),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function listStudies(): Promise<Study[]> {
  if (!isTauri()) return readLocal<Study>(STUDIES_KEY).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const rows = await (await db()).select<Record<string, unknown>[]>(
    "SELECT * FROM studies ORDER BY updated_at DESC",
  );
  return rows.map(rowToStudy);
}

export async function nextCardNumber(): Promise<number> {
  const studies = await listStudies();
  return Math.max(0, ...studies.map((study) => study.cardNumber)) + 1;
}

export async function saveStudy(study: Study): Promise<void> {
  if (!isTauri()) {
    const studies = readLocal<Study>(STUDIES_KEY).filter((item) => item.id !== study.id);
    writeLocal(STUDIES_KEY, [study, ...studies]);
    return;
  }
  await (await db()).execute(
    `INSERT INTO studies (
      id, card_number, title, source_type, source_game_id, account_id, root_fen,
      current_fen, original_pgn, move_tree, notes, tags, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title, current_fen=excluded.current_fen, move_tree=excluded.move_tree,
      notes=excluded.notes, tags=excluded.tags, updated_at=excluded.updated_at`,
    [study.id, study.cardNumber, study.title, study.sourceType, study.sourceGameId,
      study.accountId, study.rootFen, study.currentFen, study.originalPgn,
      JSON.stringify(study.moveTree), study.notes, JSON.stringify(study.tags),
      study.createdAt, study.updatedAt],
  );
}

export async function deleteStudy(id: string): Promise<void> {
  if (!isTauri()) {
    writeLocal(STUDIES_KEY, readLocal<Study>(STUDIES_KEY).filter((item) => item.id !== id));
    writeLocal(CARDS_KEY, readLocal<TrainingCard>(CARDS_KEY).filter((item) => item.studyId !== id));
    return;
  }
  await (await db()).execute("DELETE FROM studies WHERE id = ?", [id]);
}

export async function listCards(): Promise<TrainingCard[]> {
  if (!isTauri()) return readLocal<TrainingCard>(CARDS_KEY);
  const rows = await (await db()).select<Record<string, unknown>[]>(
    "SELECT * FROM training_cards ORDER BY due_at ASC",
  );
  return rows.map(rowToCard);
}

export async function saveCard(card: TrainingCard): Promise<void> {
  if (!isTauri()) {
    const cards = readLocal<TrainingCard>(CARDS_KEY).filter((item) => item.id !== card.id);
    writeLocal(CARDS_KEY, [card, ...cards]);
    return;
  }
  await (await db()).execute(
    `INSERT INTO training_cards (
      id, study_id, prompt_fen, accepted_moves, forcing_line, motif_tags,
      due_at, interval_days, lapses, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET due_at=excluded.due_at, interval_days=excluded.interval_days,
      lapses=excluded.lapses, updated_at=excluded.updated_at`,
    [card.id, card.studyId, card.promptFen, JSON.stringify(card.acceptedMoves),
      JSON.stringify(card.forcingLine), JSON.stringify(card.motifTags), card.dueAt,
      card.intervalDays, card.lapses, card.createdAt, card.updatedAt],
  );
}

export async function dueCards(now = new Date()): Promise<TrainingCard[]> {
  const cards = await listCards();
  return cards.filter((card) => new Date(card.dueAt) <= now);
}

export async function gradeCard(card: TrainingCard, grade: ReviewGrade): Promise<TrainingCard> {
  const scheduled = scheduleReview(card, grade);
  await saveCard(scheduled);
  if (isTauri()) {
    await (await db()).execute(
      "INSERT INTO review_log (id, card_id, grade, reviewed_at, interval_days) VALUES (?, ?, ?, ?, ?)",
      [crypto.randomUUID(), card.id, grade, new Date().toISOString(), scheduled.intervalDays],
    );
  }
  return scheduled;
}

async function cacheKey(request: AnalysisRequest): Promise<string> {
  const raw = `${request.fen}|${ENGINE_FINGERPRINT}|${request.multiPv}|${request.timeLimitMs}`;
  const bytes = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function getCachedAnalysis(request: AnalysisRequest): Promise<AnalysisLine[] | null> {
  if (!isTauri()) {
    return memoryAnalysisCache.get(await cacheKey(request)) ?? null;
  }
  const database = await db();
  const rows = await database.select<Array<{ cache_key: string; lines: string }>>(
    `SELECT cache_key, lines FROM analysis_cache
     WHERE fen = ? AND engine_fingerprint = ? AND multi_pv >= ? AND time_limit_ms >= ?
     ORDER BY time_limit_ms ASC LIMIT 1`,
    [request.fen, ENGINE_FINGERPRINT, request.multiPv, request.timeLimitMs],
  );
  const hit = rows[0];
  if (!hit) return null;
  await database.execute("UPDATE analysis_cache SET accessed_at = ? WHERE cache_key = ?", [new Date().toISOString(), hit.cache_key]);
  return JSON.parse(hit.lines) as AnalysisLine[];
}

export async function putCachedAnalysis(request: AnalysisRequest, lines: AnalysisLine[]): Promise<void> {
  const key = await cacheKey(request);
  if (!isTauri()) {
    memoryAnalysisCache.set(key, lines);
    return;
  }
  const database = await db();
  const serialized = JSON.stringify(lines);
  const timestamp = new Date().toISOString();
  await database.execute(
    `INSERT OR REPLACE INTO analysis_cache
      (cache_key, fen, engine_fingerprint, profile, multi_pv, time_limit_ms, lines, size_bytes, created_at, accessed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [key, request.fen, ENGINE_FINGERPRINT, request.profile, request.multiPv,
      request.timeLimitMs, serialized, new TextEncoder().encode(serialized).byteLength,
      timestamp, timestamp],
  );
  const totals = await database.select<Array<{ total: number }>>("SELECT COALESCE(SUM(size_bytes), 0) AS total FROM analysis_cache");
  if ((totals[0]?.total ?? 0) > CACHE_SOFT_LIMIT) {
    await database.execute(
      "DELETE FROM analysis_cache WHERE cache_key IN (SELECT cache_key FROM analysis_cache ORDER BY accessed_at ASC LIMIT 250)",
    );
  }
}

export async function clearAnalysisCache(): Promise<void> {
  memoryAnalysisCache.clear();
  if (isTauri()) await (await db()).execute("DELETE FROM analysis_cache");
}

export async function listPlayerAliases(): Promise<string[]> {
  if (!isTauri()) return readLocal<string>("position-zero.player-aliases");
  const rows = await (await db()).select<Array<{ alias: string }>>("SELECT alias FROM player_aliases ORDER BY created_at ASC");
  return rows.map((row) => row.alias);
}

export async function addPlayerAlias(alias: string): Promise<void> {
  const normalized = alias.trim();
  if (!normalized) return;
  if (!isTauri()) {
    const aliases = readLocal<string>("position-zero.player-aliases");
    if (!aliases.some((value) => value.toLowerCase() === normalized.toLowerCase())) {
      writeLocal("position-zero.player-aliases", [...aliases, normalized]);
    }
    return;
  }
  await (await db()).execute("INSERT OR IGNORE INTO player_aliases (alias, created_at) VALUES (?, ?)", [normalized, new Date().toISOString()]);
}
