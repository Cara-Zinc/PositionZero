import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

const host = process.env.TAURI_DEV_HOST;
const ortModule = path.resolve(process.cwd(), "public/ort/ort-wasm-simd-threaded.mjs");

// Vite deliberately refuses to load an .mjs file from `public/` as a module.
// ONNX Runtime imports this worker module dynamically, so expose just this
// generated runtime file through the dev module graph. The production build
// continues to copy the complete /public/ort directory unchanged.
const serveOrtModule = {
  name: "position-zero-ort-module",
  apply: "serve" as const,
  enforce: "pre" as const,
  resolveId(source: string) {
    return source === "/ort/ort-wasm-simd-threaded.mjs" ? ortModule : undefined;
  },
  load(id: string) {
    return id === ortModule ? fs.readFileSync(ortModule, "utf8") : undefined;
  },
};

export default defineConfig({
  plugins: [serveOrtModule, react()],
  clearScreen: false,
  server: {
    port: 1421,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1422 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
