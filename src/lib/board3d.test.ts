import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { CLASSIC_MODEL_URL, CLASSIC_PIECE_NODES, boardCameraFov, legalBoardMove, squarePosition } from "./board3d";

describe("classic 3D board", () => {
  it("fits square, wide and narrow viewports without excessive wide-screen zoom", () => {
    expect(boardCameraFov(1)).toBeCloseTo(37);
    expect(boardCameraFov(1.5)).toBeLessThan(37);
    expect(boardCameraFov(1.5)).toBeGreaterThan(30);
    expect(boardCameraFov(3)).toBe(boardCameraFov(1.5));
    expect(boardCameraFov(0.75)).toBeGreaterThan(37);
    expect(boardCameraFov(0.1)).toBe(boardCameraFov(0.5));
  });
  it("maps squares to fixed world coordinates with a dark a1 and white h1", () => {
    expect(squarePosition("a1")).toEqual([-3.5, 0, 3.5]);
    expect(squarePosition("h8")).toEqual([3.5, 0, -3.5]);
    expect(squarePosition("e4")).toEqual([0.5, 0, 0.5]);
  });
  it("delegates move legality to chess.js including captures and castles", () => {
    const fen = new Chess().fen();
    expect(legalBoardMove(fen, "e2", "e4")).toBe(true);
    expect(legalBoardMove(fen, "e2", "e5")).toBe(false);
    expect(legalBoardMove(fen, "e7", "e5")).toBe(false);
    expect(legalBoardMove("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "e1", "g1")).toBe(true);
    expect(legalBoardMove("4k3/8/8/8/3p4/4P3/8/4K3 w - - 0 1", "e3", "d4")).toBe(true);
  });
  it("ships the exact CC0 source with six independent named, textured-free pieces", () => {
    const bytes = readFileSync(`public${CLASSIC_MODEL_URL}`);
    expect(createHash("sha256").update(bytes).digest("hex"))
      .toBe("1678dd307f2d944d39786739448bca631cfdf0a13bdbb439954fb749b4a35a9a");
    expect(bytes.readUInt32LE(0)).toBe(0x46546c67);
    expect(bytes.readUInt32LE(4)).toBe(2);
    expect(bytes.readUInt32LE(8)).toBe(bytes.length);
    const gltf = JSON.parse(bytes.toString("utf8", 20, 20 + bytes.readUInt32LE(12)));
    expect(gltf.images).toBeUndefined();
    expect(gltf.buffers.every((buffer: { uri?: string }) => !buffer.uri)).toBe(true);
    const meshes = Object.values(CLASSIC_PIECE_NODES).map(name => {
      const node = gltf.nodes.find((node: { name: string }) => node.name === name);
      expect(node, name).toBeTruthy();
      const mesh = gltf.meshes[node.mesh];
      expect(mesh.primitives.length, name).toBeGreaterThan(0);
      return node.mesh;
    });
    expect(new Set(meshes).size).toBe(6);
    expect(readFileSync("third_party/chess-classic/README.md", "utf8")).toContain("CC0 1.0");
  });
});
