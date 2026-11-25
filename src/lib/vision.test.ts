import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createRecognizer: vi.fn(),
  recognize: vi.fn(),
  resolveOrientation: vi.fn(),
}));

vi.mock("@scoriiu/fenshot", () => ({
  createRecognizer: mocks.createRecognizer,
  resolveOrientation: mocks.resolveOrientation,
}));

describe("recognizeBoard", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.recognize.mockResolvedValue({
      placement: "8/8/8/8/8/8/4K3/7k",
      reliable: true,
      confidences: Array(64).fill(0.99),
    });
    mocks.createRecognizer.mockReturnValue({ recognize: mocks.recognize });
    mocks.resolveOrientation.mockReturnValue({
      placement: "k7/3K4/8/8/8/8/8/8",
      orientation: "black",
    });
  });

  it("uses the packaged WASM directory and preserves black orientation", async () => {
    const { recognizeBoard } = await import("./vision");
    const result = await recognizeBoard(new File(["fixture"], "board.png", { type: "image/png" }));

    expect(mocks.createRecognizer).toHaveBeenCalledWith({
      modelUrl: "/models/chess-tiles-v2.onnx",
      wasmPaths: "/ort/",
    });
    expect(result.orientation).toBe("black");
    expect(result.placement).toBe("k7/3K4/8/8/8/8/8/8");
  });
});
