import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Chess } from "chess.js";

const root = process.cwd();
const sourceDir = path.join(root, "third_party/lichess-openings");
const output = path.join(root, "public/data/openings.json");
const records = {};

for (const filename of (await readdir(sourceDir)).filter((name) => name.endsWith(".tsv")).sort()) {
  const lines = (await readFile(path.join(sourceDir, filename), "utf8")).split(/\r?\n/).slice(1);
  for (const line of lines) {
    if (!line.trim()) continue;
    const [eco, name, pgn] = line.split("\t");
    const chess = new Chess();
    try {
      for (const token of pgn.split(/\s+/)) {
        if (!token || /^\d+\.{1,3}$/.test(token)) continue;
        chess.move(token);
      }
      const epd = chess.fen().split(" ").slice(0, 4).join(" ");
      records[epd] = { eco, name };
    } catch {
      // Upstream validation catches malformed records; ignore one bad row without blocking install.
    }
  }
}

await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(records));
console.log(`Built ${Object.keys(records).length} offline opening positions.`);
