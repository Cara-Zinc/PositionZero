import { createRecognizer, resolveOrientation } from "@scoriiu/fenshot";
import type { VisionPosition } from "../types";

let recognizer: ReturnType<typeof createRecognizer> | null = null;

export async function recognizeBoard(file: File): Promise<VisionPosition> {
  recognizer ??= createRecognizer({
    modelUrl: "/models/chess-tiles-v2.onnx",
    wasmPaths: "/ort/",
  });
  const result = await recognizer.recognize(file);
  if (!result) throw new Error("No complete chessboard was found in this image.");
  const oriented = resolveOrientation(result.placement);
  return {
    placement: oriented.placement,
    reliable: result.reliable,
    confidences: result.confidences ?? Array(64).fill(result.reliable ? 1 : 0),
    orientation: oriented.orientation,
  };
}
