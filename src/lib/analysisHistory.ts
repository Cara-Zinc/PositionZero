import type { ImportedMove, Study } from "../types";

export function clampAnalysisCursor(cursor: number, moveCount: number): number {
  return Math.min(Math.max(0, Math.trunc(cursor)), moveCount);
}

export function fenAtCursor(rootFen: string, moves: ImportedMove[], cursor: number): string {
  const safeCursor = clampAnalysisCursor(cursor, moves.length);
  if (safeCursor === 0) return rootFen;
  return moves[safeCursor - 1]?.fenAfter ?? rootFen;
}

export function movesThroughCursor(moves: ImportedMove[], cursor: number): ImportedMove[] {
  return moves.slice(0, clampAnalysisCursor(cursor, moves.length));
}

export function cursorForStudy(study: Study): number {
  if (study.currentFen === study.rootFen) return 0;
  for (let index = study.moveTree.length - 1; index >= 0; index -= 1) {
    if (study.moveTree[index].fenAfter === study.currentFen) return index + 1;
  }
  return 0;
}
