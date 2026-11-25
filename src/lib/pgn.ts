import { Chess } from "chess.js";
import { PgnList } from "cm-pgn/src/PgnList.js";
import type { GameSourceProvider, ImportedGame, ImportedMove } from "../types";

const START_FEN = new Chess().fen();

function stableId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function parsePgnText(source: string): ImportedGame[] {
  const parsed = PgnList.parse(source.trim());
  return parsed.map((game, gameIndex) => {
    const headers = { ...game.header.tags };
    const startFen = headers.SetUp === "1" && headers.FEN ? headers.FEN : START_FEN;
    let previousFen = startFen;
    const moves: ImportedMove[] = game.history.moves.map((move, index) => {
      const imported: ImportedMove = {
        ply: move.ply ?? index + 1,
        color: move.color ?? (index % 2 === 0 ? "w" : "b"),
        san: move.san,
        uci: move.uci,
        fenBefore: previousFen,
        fenAfter: move.fen,
        comments: move.comments ?? [],
        nags: move.nags ?? [],
      };
      previousFen = move.fen;
      return imported;
    });
    const players = [headers.White || "White", headers.Black || "Black"].join(" — ");
    return {
      id: stableId(`pgn-${gameIndex + 1}`),
      title: players,
      headers,
      originalPgn: game.render(true, true, true),
      startFen,
      moves,
    };
  });
}

export const localPgnProvider: GameSourceProvider = {
  id: "local-pgn",
  async importText(text) {
    return parsePgnText(text);
  },
};

export function validateFen(fen: string): { valid: boolean; message: string } {
  try {
    const chess = new Chess(fen);
    const board = chess.board().flat();
    const whiteKings = board.filter((piece) => piece?.type === "k" && piece.color === "w").length;
    const blackKings = board.filter((piece) => piece?.type === "k" && piece.color === "b").length;
    if (whiteKings !== 1 || blackKings !== 1) {
      return { valid: false, message: "A position needs exactly one king for each side." };
    }
    return { valid: true, message: "Position is legal." };
  } catch (error) {
    return { valid: false, message: error instanceof Error ? error.message : "Invalid FEN." };
  }
}

export function fenAtPly(game: ImportedGame, ply: number): string {
  if (ply <= 0) return game.startFen;
  return game.moves[Math.min(ply, game.moves.length) - 1]?.fenAfter ?? game.startFen;
}
