import type { ImportedMove, MoveEvaluation } from "../types";

interface AnalysisTimelineProps {
  moves: ImportedMove[];
  cursor: number;
  evaluations: Record<number, MoveEvaluation>;
  onNavigate: (cursor: number) => void;
}

function notation(move: ImportedMove, index: number): string {
  const parsed = Number(move.fenBefore.split(" ")[5]);
  const moveNumber = Number.isFinite(parsed) && parsed > 0 ? parsed : Math.floor(index / 2) + 1;
  return `${moveNumber}${move.color === "w" ? "." : "…"} ${move.san}`;
}

export function AnalysisTimeline({ moves, cursor, evaluations, onNavigate }: AnalysisTimelineProps) {
  const laterPlies = moves.length - cursor;
  const positionLabel = cursor === 0 ? "ROOT POSITION" : `PLY ${cursor}`;

  return <section className="analysis-path" aria-label="Analysis path">
    <header className="analysis-path-header">
      <div className="analysis-path-title">
        <span className="eyebrow">ANALYSIS PATH</span>
        <strong>{positionLabel}</strong>
      </div>
      <div className="analysis-path-controls">
        <button type="button" onClick={() => onNavigate(0)} disabled={cursor === 0} aria-label="Go to root position">Root</button>
        <button type="button" onClick={() => onNavigate(cursor - 1)} disabled={cursor === 0} aria-label="Go to previous position">← Back</button>
        <output aria-live="polite">{String(cursor).padStart(2, "0")} / {String(moves.length).padStart(2, "0")}</output>
        <button type="button" onClick={() => onNavigate(cursor + 1)} disabled={cursor === moves.length} aria-label="Go to next position">Next →</button>
        <button type="button" onClick={() => onNavigate(moves.length)} disabled={cursor === moves.length} aria-label="Go to latest position">Latest</button>
      </div>
    </header>
    <div className="analysis-path-note">
      {laterPlies > 0
        ? `Viewing history. A new move here replaces ${laterPlies} later ${laterPlies === 1 ? "ply" : "plies"}.`
        : "Choose a board move or an engine line to extend this path."}
    </div>
    <div className="move-tape" aria-label="Recorded analysis moves">
      <button type="button" className={cursor === 0 ? "is-active" : ""} onClick={() => onNavigate(0)} aria-label="Open root position">ROOT</button>
      {moves.map((move, index) => {
        const evaluation = evaluations[move.ply];
        const moveCursor = index + 1;
        return <button
          type="button"
          key={`${moveCursor}-${move.uci}-${move.fenAfter}`}
          className={[
            cursor === moveCursor ? "is-active" : "",
            evaluation && evaluation.severity !== "info" ? `is-${evaluation.severity}` : "",
          ].filter(Boolean).join(" ")}
          onClick={() => onNavigate(moveCursor)}
          aria-label={`Open position after ${notation(move, index)}`}
        >
          <span>{notation(move, index)}</span>
          {evaluation && evaluation.severity !== "info" && <i>{evaluation.severity === "blunder" ? "??" : evaluation.severity === "mistake" ? "?" : "?!"}</i>}
        </button>;
      })}
    </div>
  </section>;
}
