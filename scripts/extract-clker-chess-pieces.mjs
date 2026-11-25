import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const sourcePath = resolve(process.argv[2] || "");
const outputDirectory = resolve(process.argv[3] || "design/extracted-clker-chess");

if (!process.argv[2]) {
  throw new Error("Usage: node scripts/extract-clker-chess-pieces.mjs <source.svg> [output-directory]");
}

const source = readFileSync(sourcePath, "utf8");
const groups = [...source.matchAll(/<g\b[^>]*>[\s\S]*?<\/g>/g)].map((match) => match[0]);
const topLevelSource = source.replace(/<g\b[^>]*>[\s\S]*?<\/g>/g, "");
const topLevelPaths = [...topLevelSource.matchAll(/<path\b[^>]*\/>/g)].map((match) => match[0]);

if (groups.length !== 25 || topLevelPaths.length !== 42) {
  throw new Error(`Unexpected source structure: found ${groups.length} groups and ${topLevelPaths.length} top-level paths`);
}

const pieces = [
  { name: "white-king", node: groups[2], viewBox: "150.82 999.9 49.18 49.18" },
  { name: "white-queen", node: groups[1], viewBox: "200 999.9 49.18 49.18" },
  { name: "white-rook", node: groups[3], viewBox: "3.2787 999.9 49.18 49.18" },
  { name: "white-bishop", node: groups[20], viewBox: "101.64 999.9 49.18 49.18" },
  { name: "white-knight", node: groups[5], viewBox: "52.459 999.9 49.18 49.18" },
  { name: "white-pawn", node: groups[19], viewBox: "3.2787 950.72 49.18 49.18" },
  { name: "black-king", node: groups[7], viewBox: "200 655.64 49.18 49.18" },
  { name: "black-queen", node: groups[8], viewBox: "150.82 655.64 49.18 49.18" },
  { name: "black-rook", node: groups[11], viewBox: "3.2787 655.64 49.18 49.18" },
  { name: "black-bishop", node: groups[9], viewBox: "101.64 655.64 49.18 49.18" },
  { name: "black-knight", node: groups[24], viewBox: "52.459 655.64 49.18 49.18" },
  { name: "black-pawn", node: topLevelPaths[41], viewBox: "3.2787 704.82 49.18 49.18" },
];

mkdirSync(outputDirectory, { recursive: true });

for (const piece of pieces) {
  const document = [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="${piece.viewBox}" role="img" aria-label="${piece.name.replace("-", " ")}">`,
    `  <!-- Extracted without redrawing from ${basename(sourcePath)}. -->`,
    `  ${piece.node}`,
    "</svg>",
    "",
  ].join("\n");
  writeFileSync(resolve(outputDirectory, `${piece.name}.svg`), document);
}

writeFileSync(resolve(outputDirectory, "manifest.json"), `${JSON.stringify({
  source: sourcePath,
  note: "The source SVG contains no embedded license metadata; verify its distribution terms before publishing.",
  pieces: pieces.map(({ name }) => `${name}.svg`),
}, null, 2)}\n`);

console.log(`Extracted ${pieces.length} pieces to ${outputDirectory}`);
