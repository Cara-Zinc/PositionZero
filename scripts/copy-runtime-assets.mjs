import { cp, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const modelTarget = path.join(root, "public/models/chess-tiles-v2.onnx");
const modelCandidates = [
  "node_modules/@scoriiu/fenshot/model/chess-tiles-v2.onnx",
  "node_modules/@scoriiu/fenshot/models/chess-tiles-v2.onnx",
  "node_modules/@scoriiu/fenshot/dist/model/chess-tiles-v2.onnx",
].map((candidate) => path.join(root, candidate));

await mkdir(path.dirname(modelTarget), { recursive: true });
const modelSource = modelCandidates.find(existsSync);
if (modelSource) await cp(modelSource, modelTarget);

const ortSource = path.join(root, "node_modules/onnxruntime-web/dist");
const ortTarget = path.join(root, "public/ort");
if (existsSync(ortSource)) {
  await mkdir(ortTarget, { recursive: true });
  for (const file of ["ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"]) {
    const source = path.join(ortSource, file);
    if (!existsSync(source)) throw new Error(`Missing ONNX Runtime asset: ${source}`);
    await cp(source, path.join(ortTarget, file));
  }
}

// The standard piece set lives in design/extracted-clker-chess so there is one
// canonical copy; public/pieces/clker is only the runtime mirror Vite serves.
// Without this step the two silently drift apart.
const pieceSource = path.join(root, "design/extracted-clker-chess");
const pieceTarget = path.join(root, "public/pieces/clker");
if (existsSync(pieceSource)) {
  await mkdir(pieceTarget, { recursive: true });
  const files = (await readdir(pieceSource)).filter((file) => file.endsWith(".svg"));
  for (const file of files) {
    await cp(path.join(pieceSource, file), path.join(pieceTarget, file));
  }
  console.log(`Synced ${files.length} standard pieces into public/pieces/clker`);
}

// Approved abstract artwork is local and bundled; no network fetch at runtime.
const redBlackSource = path.join(root, "design/porcelain-abstract-v2/pieces");
const redBlackTarget = path.join(root, "public/pieces/red-black");
await mkdir(redBlackTarget, { recursive: true });
for (const side of ["white", "black"]) for (const role of ["king", "queen", "bishop", "knight", "rook", "pawn"]) {
  const file = `${side}-${role}.png`;
  const source = path.join(redBlackSource, file);
  if (!existsSync(source)) throw new Error(`Missing approved chess artwork: ${source}`);
  await cp(source, path.join(redBlackTarget, file));
}
console.log("Synced 12 red-and-black pieces into public/pieces/red-black");
