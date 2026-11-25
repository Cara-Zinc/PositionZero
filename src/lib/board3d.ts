import { Chess, type Square } from "chess.js";

/** World coordinates never change with the camera: a1 is near White. */
export function squarePosition(square: string): [number, number, number] {
  return [square.charCodeAt(0) - 97 - 3.5, 0, 4.5 - Number(square[1])];
}

/** Fill a wide viewport a little more, without changing the user's orbit/zoom.
 * Narrow viewports retain enough horizontal field of view to avoid cropping. */
export function boardCameraFov(aspect: number): number {
  const fit = Math.min(1.2, Math.max(0.5, aspect));
  return 2 * Math.atan(Math.tan(37 * Math.PI / 360) / fit) * 180 / Math.PI;
}

export function legalBoardMove(fen: string, from: Square, to: Square): boolean {
  return from !== to && new Chess(fen).moves({ square: from, verbose: true }).some(move => move.to === to);
}

export const CLASSIC_MODEL_URL = "/models/chess-classic/Chess.glb";
export const CLASSIC_PIECE_NODES = {
  k: "WhiteKing", q: "WhiteQueen", b: "LeftWhiteBishop",
  n: "LeftWhiteKnight", r: "LeftWhiteRook", p: "WhitePawnA",
} as const;
