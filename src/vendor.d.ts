declare module "cm-pgn" {
  export class PgnList {
    static parse(source: string): Pgn[];
  }
  export class Pgn {
    header: { tags: Record<string, string> };
    history: { moves: PgnMove[] };
    render(renderHeader?: boolean, renderComments?: boolean, renderNags?: boolean): string;
  }
  export interface PgnMove {
    ply: number;
    color: "w" | "b";
    san: string;
    uci: string;
    fen: string;
    comments?: string[];
    nags?: number[];
    previous?: PgnMove;
  }
}

declare module "cm-pgn/src/PgnList.js" {
  import type { Pgn } from "cm-pgn";
  export class PgnList {
    static parse(source: string): Pgn[];
  }
}

declare module "@scoriiu/fenshot" {
  export function createRecognizer(options: {
    modelUrl: string;
    wasmPaths: string;
  }): {
    recognize(input: File | Blob | HTMLImageElement | ImageBitmap): Promise<{
      placement: string;
      reliable: boolean;
      confidences?: number[];
    } | null>;
  };
  export function resolveOrientation(placement: string): {
    placement: string;
    orientation: "white" | "black";
  };
  export function placementToFen(placement: string, turn: "w" | "b"): string;
}
