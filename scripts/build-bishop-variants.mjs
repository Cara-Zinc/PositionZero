import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const sourceDirectory = resolve("design/extracted-clker-chess");
const outputPath = resolve("design/bishop-variants-v1.svg");
const encode = (name) => readFileSync(resolve(sourceDirectory, name)).toString("base64");

const whiteBishop = `data:image/svg+xml;base64,${encode("white-bishop.svg")}`;
const blackBishop = `data:image/svg+xml;base64,${encode("black-bishop.svg")}`;

const variants = [
  {
    code: "A",
    name: "LOW PLINTH",
    note: "compact / classical",
    path: "M40 67C44 72 56 72 60 67L64 77 76 83C80 85 82 88 82 93H18C18 88 20 85 24 83L36 77Z",
  },
  {
    code: "B",
    name: "BELL FOOT",
    note: "soft / balanced",
    path: "M42 67C44 73 56 73 58 67C61 77 68 81 78 85C82 87 84 90 84 94H16C16 90 18 87 22 85C32 81 39 77 42 67Z",
  },
  {
    code: "C",
    name: "OVAL STAND",
    note: "stable / minimal",
    path: "M39 68C44 73 56 73 61 68C61 78 66 83 73 86H80C83 86 85 88 85 91S83 96 80 96H20C17 96 15 94 15 91S17 86 20 86H27C34 83 39 78 39 68Z",
  },
  {
    code: "D",
    name: "ARCHED BASE",
    note: "broad / sculptural",
    path: "M40 68C44 72 56 72 60 68C62 76 70 81 82 85L85 91C75 95 63 97 50 97S25 95 15 91L18 85C30 81 38 76 40 68Z",
  },
];

const cardX = (index) => 45 + index * 205;
const piece = (href, x, y, path, color) => {
  if (!path) return `<image href="${href}" x="${x + 31}" y="${y + 10}" width="118" height="118" />`;
  return `<g transform="translate(${x + 31} ${y + 10}) scale(1.18)">
    <image href="${href}" width="100" height="100" clip-path="url(#bishop-top)" />
    <path d="${path}" class="${color}-base" />
  </g>`;
};

const concepts = [{ code: "0", name: "ORIGINAL", note: "split feet", path: null }, ...variants];
const cards = concepts.map((variant, index) => {
  const x = cardX(index);
  return `<g>
    <rect class="card ${index % 2 ? "hatched" : "plain"}" x="${x}" y="120" width="180" height="170" rx="5" />
    ${piece(whiteBishop, x, 120, variant.path, "white")}
    <text class="code" x="${x + 16}" y="144">${variant.code}</text>
    <text class="name" x="${x + 90}" y="270">${variant.name}</text>
    <rect class="card ${index % 2 ? "plain" : "hatched"}" x="${x}" y="320" width="180" height="170" rx="5" />
    ${piece(blackBishop, x, 320, variant.path, "black")}
    <text class="code" x="${x + 16}" y="344">${variant.code}</text>
    <text class="name" x="${x + 90}" y="470">${variant.note.toUpperCase()}</text>
  </g>`;
}).join("\n");

const document = `<svg xmlns="http://www.w3.org/2000/svg" width="1115" height="545" viewBox="0 0 1115 545" role="img" aria-labelledby="title desc">
  <title id="title">Bishop base variants</title>
  <desc id="desc">The original bishop and four alternatives replacing its split feet with a single unified base.</desc>
  <defs>
    <clipPath id="bishop-top" clipPathUnits="userSpaceOnUse"><rect width="100" height="72" /></clipPath>
    <pattern id="hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="#f8faf6"/><path d="M0 0v10" stroke="#d2d7d1" stroke-width="1.5"/></pattern>
    <style>
      .page { fill: #e8ece6; }
      .card { stroke: #aeb7af; stroke-width: 1; }
      .plain { fill: #f8faf6; }
      .hatched { fill: url(#hatch); }
      .white-base { fill: #fff; stroke: #000; stroke-width: 3.7; stroke-linejoin: round; }
      .black-base { fill: #000; stroke: #000; stroke-width: 3.7; stroke-linejoin: round; }
      .title { fill: #17201b; font: 600 29px Georgia, serif; }
      .subtitle { fill: #536058; font: 11px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .08em; }
      .row { fill: #536058; font: 700 9px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .12em; }
      .code { fill: #17201b; font: 700 10px ui-monospace, SFMono-Regular, Menlo, monospace; }
      .name { fill: #536058; font: 700 9px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .1em; text-anchor: middle; }
    </style>
  </defs>
  <rect class="page" width="1115" height="545" />
  <text class="title" x="45" y="52">Bishop — unified base studies</text>
  <text class="subtitle" x="45" y="79">ORIGINAL UPPER SILHOUETTE · FOUR NON-SPLIT FOOT VARIANTS · BLACK EDGE FOR BOTH SIDES</text>
  <text class="row" x="45" y="108">WHITE</text>
  <text class="row" x="45" y="308">BLACK</text>
  ${cards}
</svg>`;

writeFileSync(outputPath, `${document}\n`);
console.log(`Wrote ${outputPath}`);
