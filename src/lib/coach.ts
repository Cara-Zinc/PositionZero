import { Chess, type Square } from "chess.js";
import type { AnalysisLine, CoachInsight } from "../types";

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function fallback(line: AnalysisLine): CoachInsight {
  return {
    motif: "ENGINE PREFERENCE",
    severity: "info",
    confidence: 0.35,
    evidenceSquares: [],
    evidencePlies: line.pvUci.slice(0, 4),
    message: "The engine prefers this line, but no single tactical cause was detected.",
  };
}

export function explainLine(fen: string, line?: AnalysisLine): CoachInsight {
  if (!line?.pvUci.length) return fallback(line ?? {
    rank: 1, scoreCp: null, mateIn: null, wdl: null, depth: 0, selDepth: 0,
    nodes: 0, nps: 0, hashFull: 0, pvUci: [],
  });
  const chess = new Chess(fen);
  const uci = line.pvUci[0];
  const from = uci.slice(0, 2) as Square;
  const to = uci.slice(2, 4) as Square;
  const target = chess.get(to);
  let move: ReturnType<Chess["move"]>;
  try {
    move = chess.move({ from, to, promotion: (uci[4] || "q") as "q" | "r" | "b" | "n" });
  } catch {
    return fallback(line);
  }
  if (!move) return fallback(line);

  if (line.mateIn !== null) {
    return {
      motif: "FORCING MATE",
      severity: "info",
      confidence: 0.99,
      evidenceSquares: [from, to],
      evidencePlies: line.pvUci.slice(0, 6),
      message: `${move.san} starts a forced mating sequence. Check every reply before considering quieter moves.`,
    };
  }
  if (move.promotion) {
    return {
      motif: "PROMOTION",
      severity: "info",
      confidence: 0.98,
      evidenceSquares: [from, to],
      evidencePlies: line.pvUci.slice(0, 4),
      message: `${move.san} converts the advanced pawn immediately; delaying gives the defender time to blockade it.`,
    };
  }
  if (move.isCapture() && target && VALUE[target.type] >= 3) {
    return {
      motif: "LOOSE PIECE",
      severity: "info",
      confidence: 0.92,
      evidenceSquares: [from, to],
      evidencePlies: line.pvUci.slice(0, 4),
      message: `${move.san} wins a ${target.type === "q" ? "queen" : "piece"} that cannot be left en prise.`,
    };
  }
  if (move.san.includes("+")) {
    return {
      motif: "FORCING CHECK",
      severity: "info",
      confidence: 0.88,
      evidenceSquares: [from, to],
      evidencePlies: line.pvUci.slice(0, 5),
      message: `${move.san} gains time with check and limits the opponent's replies. Calculate the forced line first.`,
    };
  }

  const movedPiece = chess.get(to);
  if (movedPiece) {
    const attackedMajorPieces = chess.board().flat().filter((piece) => {
      if (!piece || piece.color === movedPiece.color || VALUE[piece.type] < 3) return false;
      return chess.attackers(piece.square, movedPiece.color).some((square) => square === to);
    });
    if (attackedMajorPieces.length >= 2) {
      return {
        motif: "FORK",
        severity: "info",
        confidence: 0.9,
        evidenceSquares: [to, ...attackedMajorPieces.map((piece) => piece!.square)],
        evidencePlies: line.pvUci.slice(0, 4),
        message: `${move.san} attacks two valuable targets at once. The defender cannot save both cleanly.`,
      };
    }
  }
  return fallback(line);
}

export function expectation(line?: AnalysisLine): number {
  if (line?.wdl) return (line.wdl.win + line.wdl.draw * 0.5) / 1000;
  if (line?.mateIn !== null && line?.mateIn !== undefined) return line.mateIn > 0 ? 1 : 0;
  const cp = line?.scoreCp ?? 0;
  return 1 / (1 + Math.exp(-cp / 180));
}
