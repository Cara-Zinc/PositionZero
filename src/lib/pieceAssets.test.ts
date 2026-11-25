import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("bundled red-and-black piece artwork", () => {
  const source = "design/porcelain-abstract-v2/pieces";
  const runtime = "public/pieces/red-black";
  const names = ["white", "black"].flatMap(side =>
    ["king", "queen", "bishop", "knight", "rook", "pawn"].map(role => `${side}-${role}.png`));

  it("ships exactly twelve approved sprites with no runtime mirror drift", () => {
    expect(readdirSync(runtime).filter(file => file.endsWith(".png")).sort()).toEqual([...names].sort());
    for (const name of names) expect(readFileSync(`${runtime}/${name}`).equals(readFileSync(`${source}/${name}`)), name).toBe(true);
  });

  it("uses square 512px RGBA PNG files rather than opaque or renamed images", () => {
    for (const name of names) {
      const png = readFileSync(`${runtime}/${name}`);
      expect(png.subarray(0, 8).toString("hex"), name).toBe("89504e470d0a1a0a");
      expect(png.toString("ascii", 12, 16), name).toBe("IHDR");
      expect(png.readUInt32BE(16), name).toBe(512);
      expect(png.readUInt32BE(20), name).toBe(512);
      expect(png[25], name).toBe(6);
    }
  });

  it("enlarges only board porcelain sprites by 1.3 without clipping their visible bounds", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toContain(".chess-piece > .chess-piece-porcelain { transform: translateY(-1%) scale(1.3);");
    const manifest = JSON.parse(readFileSync(`${source}/manifest.json`, "utf8")) as Array<{
      baseline: number; canvas: number; visibleWidth: number; visibleHeight: number;
    }>;
    for (const piece of manifest) {
      // Board wrapper is 90% of a square; translateY is 1% of that wrapper.
      const top = 0.5 + 0.9 * 1.3 * ((piece.baseline - piece.visibleHeight) / piece.canvas - 0.5) - 0.009;
      const bottom = 0.5 + 0.9 * 1.3 * (piece.baseline / piece.canvas - 0.5) - 0.009;
      expect(top).toBeGreaterThan(0);
      expect(bottom).toBeLessThan(1);
      expect(0.9 * 1.3 * piece.visibleWidth / piece.canvas).toBeLessThan(1);
    }
  });
});
