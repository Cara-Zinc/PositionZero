import { useId, useState, type DragEvent, type KeyboardEvent } from "react";
import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";
import { useMemo } from "react";
import { useThemeId } from "../lib/appearance";
import { PIECE_GEOMETRY, PIECE_VIEW_BOX } from "../lib/pieceGeometry";
import { resolveTheme, type ThemeId } from "../lib/themes";

const PIECE_NAMES: Record<PieceSymbol, string> = {
  k: "king", q: "queen", r: "rook", b: "bishop", n: "knight", p: "pawn",
};

const COLOR_FILE_NAMES: Record<Color, string> = { w: "white", b: "black" };

/**
 * Draws one piece in the active skin's artwork.
 *
 * Skins either use the standard Position Zero set, which ships as finished black
 * and white files, transparent red-and-black PNG artwork, or traced geometry,
 * geometry and therefore takes the skin's body / panel / trim / edge colours.
 * `themeId` lets the skin picker preview a skin other than the active one.
 */
export function PieceGlyph({ type, color, themeId }: { type: PieceSymbol; color: Color; themeId?: ThemeId }) {
  const activeThemeId = useThemeId();
  const art = useMemo(() => resolveTheme(themeId ?? activeThemeId).pieceArt, [themeId, activeThemeId]);

  if (art.kind === "standard" || art.kind === "porcelain") {
    return <img
      className={`chess-piece-svg chess-piece-${art.kind}`}
      src={`${art.directory}/${COLOR_FILE_NAMES[color]}-${PIECE_NAMES[type]}.${art.kind === "porcelain" ? "png" : "svg"}`}
      alt=""
      aria-hidden="true"
      draggable={false}
    />;
  }

  const shape = PIECE_GEOMETRY[color][type];
  return (
    <svg className="chess-piece-svg chess-piece-carved" viewBox={PIECE_VIEW_BOX} aria-hidden="true" focusable="false">
      <path className="piece-layer piece-body" d={shape.silhouette} />
      {shape.panel && <path className="piece-layer piece-panel" d={shape.panel} />}
      {shape.trim && <path className="piece-layer piece-trim" d={shape.trim} />}
    </svg>
  );
}

interface Arrow {
  from: string;
  to: string;
}

export interface ChessBoardProps {
  fen: string;
  orientation?: Color;
  disabled?: boolean;
  arrows?: Arrow[];
  evidenceSquares?: string[];
  confidence?: number[];
  onMove?: (from: Square, to: Square) => boolean | void;
}

function orderedSquares(orientation: Color): Square[] {
  const files = orientation === "w" ? "abcdefgh" : "hgfedcba";
  const ranks = orientation === "w" ? "87654321" : "12345678";
  return [...ranks].flatMap((rank) => [...files].map((file) => `${file}${rank}` as Square));
}

function edgeLabels(orientation: Color): { files: string[]; ranks: string[] } {
  return orientation === "w"
    ? { files: [..."ABCDEFGH"], ranks: [..."87654321"] }
    : { files: [..."HGFEDCBA"], ranks: [..."12345678"] };
}

function center(square: string, orientation: Color): [number, number] {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  const x = orientation === "w" ? file + 0.5 : 7.5 - file;
  const y = orientation === "w" ? 7.5 - rank : rank + 0.5;
  return [x * 12.5, y * 12.5];
}

function arrowLine(from: string, to: string, orientation: Color): { x1: number; y1: number; x2: number; y2: number } {
  const [x1, y1] = center(from, orientation);
  const [x2, y2] = center(to, orientation);
  const distance = Math.hypot(x2 - x1, y2 - y1) || 1;
  const dx = (x2 - x1) / distance;
  const dy = (y2 - y1) / distance;
  return { x1: x1 + dx * 2, y1: y1 + dy * 2, x2: x2 - dx * 3.5, y2: y2 - dy * 3.5 };
}

export function ChessBoard({
  fen,
  orientation = "w",
  disabled = false,
  arrows = [],
  evidenceSquares = [],
  confidence,
  onMove,
}: ChessBoardProps) {
  const chess = useMemo(() => new Chess(fen), [fen]);
  const squares = useMemo(() => orderedSquares(orientation), [orientation]);
  const labels = useMemo(() => edgeLabels(orientation), [orientation]);
  const arrowMarkerId = useId().replace(/:/g, "");
  const [selected, setSelected] = useState<Square | null>(null);
  const targets = useMemo(() => selected
    ? chess.moves({ square: selected, verbose: true }).map((move) => move.to)
    : [], [chess, selected]);

  function attempt(from: Square, to: Square): void {
    if (disabled || from === to) return;
    const legal = chess.moves({ square: from, verbose: true }).some((move) => move.to === to);
    if (!legal) return;
    try {
      if (onMove?.(from, to) !== false) setSelected(null);
    } catch {
      // The parent position may have changed between pointer-down and drop.
      // Treat that race as a rejected move instead of crashing the WebView.
      setSelected(null);
    }
  }

  function clickSquare(square: Square): void {
    if (disabled) return;
    if (selected && targets.includes(square)) {
      attempt(selected, square);
      return;
    }
    const piece = chess.get(square);
    setSelected(piece?.color === chess.turn() ? square : null);
  }

  function drop(event: DragEvent, to: Square): void {
    event.preventDefault();
    const from = event.dataTransfer.getData("application/x-position-zero-square") as Square;
    if (from) attempt(from, to);
  }

  function keyDown(event: KeyboardEvent<HTMLButtonElement>, square: Square, index: number): void {
    const delta = event.key === "ArrowRight" ? 1
      : event.key === "ArrowLeft" ? -1
      : event.key === "ArrowDown" ? 8
      : event.key === "ArrowUp" ? -8 : 0;
    if (delta) {
      event.preventDefault();
      const next = Math.max(0, Math.min(63, index + delta));
      document.querySelector<HTMLButtonElement>(`[data-board-index="${next}"]`)?.focus();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      clickSquare(square);
    }
  }

  return (
    <div className="board-frame">
      <div className="board-layout">
        <div className="board-ranks" aria-hidden="true">
          {labels.ranks.map((rank) => <span key={rank}>{rank}</span>)}
        </div>
        <div className="chess-board" role="grid" aria-label="Chess position">
        {squares.map((square, index) => {
          const piece = chess.get(square);
          const dark = ((square.charCodeAt(0) - 97) + Number(square[1])) % 2 === 1;
          const unreliable = confidence && (confidence[index] ?? 1) < 0.82;
          return (
            <button
              type="button"
              role="gridcell"
              key={square}
              data-board-index={index}
              className={[
                "board-square", dark ? "is-dark" : "is-light",
                selected === square ? "is-selected" : "",
                targets.includes(square) ? "is-target" : "",
                evidenceSquares.includes(square) ? "is-evidence" : "",
                unreliable ? "is-unreliable" : "",
              ].filter(Boolean).join(" ")}
              aria-label={`${square}${piece ? `, ${piece.color === "w" ? "white" : "black"} ${PIECE_NAMES[piece.type]}` : ""}`}
              onClick={() => clickSquare(square)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => drop(event, square)}
              onKeyDown={(event) => keyDown(event, square, index)}
            >
              {piece && (
                <span
                  className={`chess-piece piece-${piece.color}`}
                  draggable={!disabled && piece.color === chess.turn()}
                  onDragStart={(event) => {
                    event.dataTransfer.setData("application/x-position-zero-square", square);
                    event.dataTransfer.effectAllowed = "move";
                    setSelected(square);
                  }}
                  aria-hidden="true"
                >
                  <PieceGlyph type={piece.type} color={piece.color} />
                </span>
              )}
              <span className="square-coordinate" aria-hidden="true">{square}</span>
            </button>
          );
        })}
        {arrows.length > 0 && (
          <svg className="board-arrows" viewBox="0 0 100 100" aria-hidden="true">
            <defs>
              <marker id={arrowMarkerId} markerWidth="3.5" markerHeight="3.5" refX="3" refY="1.75" orient="auto" markerUnits="userSpaceOnUse">
                <path d="M0 0 3.5 1.75 0 3.5 .8 1.75Z" fill="currentColor" />
              </marker>
            </defs>
            {arrows.map((arrow, index) => {
              const points = arrowLine(arrow.from, arrow.to, orientation);
              return <line key={`${arrow.from}-${arrow.to}-${index}`} {...points} markerEnd={`url(#${arrowMarkerId})`} />;
            })}
          </svg>
        )}
        </div>
        <span className="board-corner" aria-hidden="true" />
        <div className="board-files" aria-hidden="true">
          {labels.files.map((file) => <span key={file}>{file}</span>)}
        </div>
      </div>
    </div>
  );
}
