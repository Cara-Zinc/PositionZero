import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import type { ImportedMove, Study } from "../types";
import { clampAnalysisCursor, cursorForStudy, fenAtCursor, movesThroughCursor } from "./analysisHistory";

function line(): { rootFen: string; moves: ImportedMove[] } {
  const chess = new Chess();
  const rootFen = chess.fen();
  const moves: ImportedMove[] = [];
  for (const uci of ["e2e4", "e7e5"]) {
    const fenBefore = chess.fen();
    const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4) });
    moves.push({
      ply: moves.length + 1,
      color: move.color,
      san: move.san,
      uci,
      fenBefore,
      fenAfter: chess.fen(),
      comments: [],
      nags: [],
    });
  }
  return { rootFen, moves };
}

describe("analysis history", () => {
  it("navigates from the root through every recorded position", () => {
    const { rootFen, moves } = line();
    expect(fenAtCursor(rootFen, moves, 0)).toBe(rootFen);
    expect(fenAtCursor(rootFen, moves, 1)).toBe(moves[0].fenAfter);
    expect(fenAtCursor(rootFen, moves, 2)).toBe(moves[1].fenAfter);
  });

  it("clamps navigation outside the recorded path", () => {
    const { rootFen, moves } = line();
    expect(clampAnalysisCursor(-3, moves.length)).toBe(0);
    expect(clampAnalysisCursor(99, moves.length)).toBe(2);
    expect(fenAtCursor(rootFen, moves, 99)).toBe(moves[1].fenAfter);
  });

  it("restores the saved cursor for every study source", () => {
    const { rootFen, moves } = line();
    const study = {
      rootFen,
      currentFen: moves[0].fenAfter,
      moveTree: moves,
    } as Study;
    expect(cursorForStudy(study)).toBe(1);
    expect(cursorForStudy({ ...study, currentFen: rootFen })).toBe(0);
  });

  it("keeps only the path through the selected history node before branching", () => {
    const { moves } = line();
    expect(movesThroughCursor(moves, 1)).toEqual([moves[0]]);
    expect(movesThroughCursor(moves, 0)).toEqual([]);
  });
});
