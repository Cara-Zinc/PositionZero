import { describe, expect, it } from "vitest";
import { fenAtPly, parsePgnText, validateFen } from "./pgn";

const SAMPLE = `[Event "Training"]
[White "Zero"]
[Black "Pattern"]
[Result "1-0"]

1. e4 e5 (1... c5 {Sicilian}) 2. Nf3 $1 Nc6 3. Bb5 a6 1-0`;

describe("PGN import", () => {
  it("preserves source annotations and builds mainline FENs", () => {
    const [game] = parsePgnText(SAMPLE);
    expect(game.title).toBe("Zero — Pattern");
    expect(game.moves).toHaveLength(6);
    expect(game.moves[1].san).toBe("e5");
    expect(game.originalPgn).toContain("Sicilian");
    expect(fenAtPly(game, 2)).toBe(game.moves[1].fenAfter);
  });

  it("rejects incomplete FEN metadata", () => {
    expect(validateFen("8/8/8/8/8/8/8/8 w - - 0 1").valid).toBe(false);
    expect(validateFen("not-a-fen").valid).toBe(false);
  });
});
