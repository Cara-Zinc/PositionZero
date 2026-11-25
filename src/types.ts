export type Color = "w" | "b";
export type Severity = "info" | "inaccuracy" | "mistake" | "blunder";
export type EngineProfileName = "quick" | "scan" | "deep";

export interface EngineSettings {
  threads: number;
  hashMb: number;
  multiPv: number;
  depth: number;
}

export interface Wdl {
  win: number;
  draw: number;
  loss: number;
}

export interface AnalysisRequest {
  fen: string;
  profile: EngineProfileName;
  multiPv: number;
  timeLimitMs: number;
  threads?: number;
  hashMb?: number;
  depth?: number;
}

export interface AnalysisLine {
  rank: number;
  scoreCp: number | null;
  mateIn: number | null;
  wdl: Wdl | null;
  depth: number;
  selDepth: number;
  nodes: number;
  nps: number;
  hashFull: number;
  pvUci: string[];
}

export interface EngineStatus {
  state: "stopped" | "starting" | "ready" | "thinking" | "error";
  engineName: string | null;
  currentJobId: string | null;
  message: string | null;
}

export interface EngineInfoEvent {
  jobId: string;
  line: AnalysisLine;
}

export interface EngineCompleteEvent {
  jobId: string;
  bestMove: string | null;
  lines: AnalysisLine[];
}

export interface CoachInsight {
  motif: string;
  severity: Severity;
  confidence: number;
  evidenceSquares: string[];
  evidencePlies: string[];
  message: string;
}

export interface ImportedMove {
  ply: number;
  color: Color;
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  comments: string[];
  nags: number[];
}

export interface ImportedGame {
  id: string;
  title: string;
  headers: Record<string, string>;
  originalPgn: string;
  startFen: string;
  moves: ImportedMove[];
}

export interface MoveEvaluation {
  ply: number;
  expectationBefore: number;
  expectationAfter: number;
  loss: number;
  severity: Severity;
  bestMove: string | null;
  lines: AnalysisLine[];
}

export interface Study {
  id: string;
  cardNumber: number;
  title: string;
  sourceType: "pgn" | "fen" | "vision" | "manual";
  sourceGameId: string | null;
  accountId: string | null;
  rootFen: string;
  currentFen: string;
  originalPgn: string | null;
  moveTree: ImportedMove[];
  notes: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type ReviewGrade = "again" | "hard" | "good";

export interface TrainingCard {
  id: string;
  studyId: string;
  promptFen: string;
  acceptedMoves: string[];
  forcingLine: string[];
  motifTags: string[];
  dueAt: string;
  intervalDays: number;
  lapses: number;
  createdAt: string;
  updatedAt: string;
}

export interface VisionPosition {
  placement: string;
  reliable: boolean;
  confidences: number[];
  orientation: "white" | "black";
}

export interface GameSourceProvider {
  readonly id: string;
  importText(text: string): Promise<ImportedGame[]>;
}
