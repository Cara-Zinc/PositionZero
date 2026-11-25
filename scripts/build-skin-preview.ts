/**
 * Renders every board skin into one proof sheet.
 *
 *   npx vite-node scripts/build-skin-preview.ts
 *
 * The sheet is laid out on absolute coordinates and every board stamps its own
 * grid origin onto the markup as `data-grid-*`, so a rendered PNG can be checked
 * square by square against the palette that produced it. Draws from the same
 * tokens and the same piece geometry the app ships.
 *
 * Output: design/skins-preview.html
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { boardCssVars, resolvePalette, THEMES } from "../src/lib/themes";
import { PIECE_GEOMETRY, PIECE_VIEW_BOX } from "../src/lib/pieceGeometry";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const FILES = "abcdefgh";
const CAMPS = ["w", "b"] as const;
const ORDER = ["k", "q", "b", "n", "r", "p"] as const;
const PIECE_LABELS: Record<string, string> = {
  k: "king", q: "queen", b: "bishop", n: "knight", r: "rook", p: "pawn",
};

const CELL = 34;
const GRID = CELL * 8;
const GUTTER = 15;
const PAD = 8;
const EDGE = 2;
const BOARD_W = PAD + GUTTER + GRID + EDGE * 2 + PAD;
const BOARD_H = PAD + GRID + EDGE * 2 + GUTTER + PAD;
const GRID_X = PAD + GUTTER + EDGE;
const GRID_Y = PAD + EDGE;

const CARD_W = 660;
const CARD_H = 648;
const CARD_GAP = 20;
const SHEET_PAD = 32;
const HEADER_H = 70;
const SHEET_W = SHEET_PAD * 2 + CARD_W * 2 + CARD_GAP;
const SHEET_H = SHEET_PAD + HEADER_H + CARD_H * 2 + CARD_GAP + SHEET_PAD;

/** Geometry the verification step reads back out of the generated markup. */
export const LAYOUT = {
  cell: CELL, gridSize: GRID, boardWidth: BOARD_W, boardHeight: BOARD_H,
  gridOffsetX: GRID_X, gridOffsetY: GRID_Y, cardWidth: CARD_W, cardHeight: CARD_H,
  sheetWidth: SHEET_W, sheetHeight: SHEET_H,
};

type Placed = { piece: string; color: "w" | "b" };
type Theme = (typeof THEMES)[number];

function startPosition(): Map<string, Placed> {
  const board = new Map<string, Placed>();
  START_FEN.split(" ")[0]!.split("/").forEach((row, index) => {
    let file = 0;
    for (const token of row) {
      if (/\d/.test(token)) { file += Number(token); continue; }
      board.set(`${FILES[file]}${8 - index}`, {
        piece: token.toLowerCase(),
        color: token === token.toUpperCase() ? "w" : "b",
      });
      file += 1;
    }
  });
  return board;
}

/** The standard set is a set of finished files, so inline them to stay portable. */
function standardPiece(theme: Theme, placed: Placed): string {
  if (theme.pieceArt.kind !== "standard") throw new Error("not a standard-art skin");
  const stem = PIECE_LABELS[placed.piece] ?? "pawn";
  const raw = readFileSync(
    resolve(`public${theme.pieceArt.directory}/${placed.color === "w" ? "white" : "black"}-${stem}.svg`), "utf8");
  const viewBox = /viewBox="([^"]+)"/.exec(raw)?.[1] ?? "0 0 100 100";
  const body = raw.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>[\s\S]*$/, "");
  const size = (CELL * 0.86).toFixed(1);
  return `<span class="std" style="width:${size}px;height:${size}px">`
    + `<svg viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet">${body}</svg></span>`;
}

function pieceMarkup(theme: Theme, placed: Placed): string {
  if (theme.pieceArt.kind === "porcelain") {
    const file = resolve(`public${theme.pieceArt.directory}/${placed.color === "w" ? "white" : "black"}-${PIECE_LABELS[placed.piece]}.png`);
    const data = readFileSync(file).toString("base64");
    return `<span class="wrap"><img style="width:100%;height:100%;object-fit:contain" src="data:image/png;base64,${data}" alt=""/></span>`;
  }
  if (theme.pieceArt.kind === "standard") {
    return `<span class="wrap ${placed.color === "w" ? "pw" : "pb"}">${standardPiece(theme, placed)}</span>`;
  }
  const shape = PIECE_GEOMETRY[placed.color][placed.piece as keyof typeof PIECE_GEOMETRY["w"]];
  const layers = [
    `<path class="body" d="${shape.silhouette}"/>`,
    shape.panel ? `<path class="panel" d="${shape.panel}"/>` : "",
    shape.trim ? `<path class="trim" d="${shape.trim}"/>` : "",
  ].join("");
  return `<span class="wrap ${placed.color === "w" ? "pw" : "pb"}">`
    + `<svg class="carved" viewBox="${PIECE_VIEW_BOX}">${layers}</svg></span>`;
}

function squares(theme: Theme): string {
  const board = startPosition();
  return [..."87654321"].flatMap((rank) => [...FILES].map((file) => {
    const dark = ((file.charCodeAt(0) - 97) + Number(rank)) % 2 === 1;
    const placed = board.get(`${file}${rank}`);
    const x = GRID_X + (file.charCodeAt(0) - 97) * CELL;
    const y = GRID_Y + (8 - Number(rank)) * CELL;
    return `<span class="sq ${dark ? "dark" : "light"}" style="left:${x}px;top:${y}px">${placed ? pieceMarkup(theme, placed) : ""}</span>`;
  })).join("");
}

interface Placement { left: number; top: number; originX: number; originY: number }

function board(theme: Theme, inverted: boolean, placement: Placement): string {
  const variables = Object.entries(boardCssVars(resolvePalette(theme, inverted)))
    .map(([name, value]) => `${name}:${value}`).join(";");
  const ranks = [..."87654321"].map((rank, index) =>
    `<span class="rank" style="left:${PAD}px;top:${GRID_Y + index * CELL}px">${rank}</span>`).join("");
  const files = [...FILES.toUpperCase()].map((file, index) =>
    `<span class="file" style="left:${GRID_X + index * CELL}px;top:${GRID_Y + GRID}px">${file}</span>`).join("");
  return `<div class="board" data-skin="${theme.id}" data-mode="${inverted ? "night" : "day"}"
      data-grid-x="${placement.originX + GRID_X}" data-grid-y="${placement.originY + GRID_Y}" data-cell="${CELL}"
      style="left:${placement.left}px;top:${placement.top}px;width:${BOARD_W}px;height:${BOARD_H}px;${variables}">${squares(theme)}${ranks}${files}</div>`;
}

function chips(theme: Theme, left: number, top: number): string {
  const palette = resolvePalette(theme, false);
  const tokens: Array<[string, string]> = [
    ["light", palette.light], ["dark", palette.dark], ["weave", palette.darkWeave ?? "none"],
    ["mount", palette.frameSurface], ["rule", palette.frameLine], ["label", palette.frameInk],
    ["mark light", palette.inkOnLight], ["mark dark", palette.inkOnDark], ["piece light", palette.lightPiece.fill],
    ["edge light", palette.lightPiece.edge], ["piece dark", palette.darkPiece.fill], ["edge dark", palette.darkPiece.edge],
  ];
  return `<div class="chips" style="left:${left}px;top:${top}px;width:${CARD_W - 36}px">${tokens.map(([label, hex]) =>
    `<span class="chip"><i style="background:${hex}"></i><b>${label}</b><code>${hex}</code></span>`).join("")}</div>`;
}

const skins = THEMES.map((theme, index) => {
  const column = index % 2;
  const row = Math.floor(index / 2);
  const cardX = SHEET_PAD + column * (CARD_W + CARD_GAP);
  const cardY = SHEET_PAD + HEADER_H + row * (CARD_H + CARD_GAP);
  const boardLeft = (half: number) => 18 + half * (BOARD_W + 14);
  const boardTop = 74;
  const modeTop = boardTop - 14;
  const chipsTop = boardTop + BOARD_H + 36;
  const card = (half: number) => ({
    // Card-relative for the markup, page-relative for the verification stamp.
    left: boardLeft(half),
    top: boardTop,
    originX: cardX + boardLeft(half),
    originY: cardY + boardTop,
  });
  return `<section class="skin" style="left:${cardX}px;top:${cardY}px;width:${CARD_W}px;height:${CARD_H}px">
      <h2 style="left:18px;top:13px">${theme.label}</h2>
      <p class="caption" style="left:18px;top:38px">${theme.caption}</p>
      <p class="mode" style="left:18px;top:${modeTop}px">DAY</p>
      <p class="mode" style="left:${boardLeft(1)}px;top:${modeTop}px">NIGHT</p>
      ${board(theme, false, card(0))}
      ${board(theme, true, card(1))}
      ${chips(theme, 18, chipsTop)}
      <p class="note" style="left:18px;top:${chipsTop + 140}px;width:${CARD_W - 36}px">${theme.note}</p>
    </section>`;
}).join("\n    ");

const document = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Position Zero — board skins</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  body { width: ${SHEET_W}px; height: ${SHEET_H}px; background: #eef0ec; color: #232d29;
    font: 13px "SFMono-Regular", "SF Mono", Menlo, monospace; }
  .sheet { position: relative; width: ${SHEET_W}px; height: ${SHEET_H}px; }
  .sheet-head { position: absolute; left: ${SHEET_PAD}px; top: ${SHEET_PAD - 4}px; width: ${SHEET_W - SHEET_PAD * 2}px;
    display: flex; align-items: baseline; justify-content: space-between; padding-bottom: 13px; border-bottom: 2px solid #232d29; }
  h1 { font: 600 28px Georgia, serif; }
  .sheet-head span { font-size: 10px; letter-spacing: .17em; text-transform: uppercase; opacity: .55; }
  .skin { position: absolute; background: #f7f8f5; border: 1px solid #232d29; }
  .skin h2, .skin p { position: absolute; }
  .skin h2 { font: 600 18px Georgia, serif; }
  .caption { font-size: 9px; letter-spacing: .09em; text-transform: uppercase; opacity: .6; }
  .mode { font-size: 8px; font-weight: 700; letter-spacing: .17em; opacity: .5; }
  .board { position: absolute; border: 1px solid var(--board-frame-line); background: var(--board-frame-surface); }
  .sq { position: absolute; width: ${CELL}px; height: ${CELL}px; display: grid; place-items: center; }
  .sq.light { background-color: var(--board-light); background-image: var(--board-light-texture); color: var(--board-ink-light); }
  .sq.dark { background-color: var(--board-dark); background-image: var(--board-dark-texture); color: var(--board-ink-dark); }
  .rank, .file { position: absolute; width: ${CELL}px; height: ${CELL}px; display: grid; place-items: center;
    color: var(--board-frame-ink); font-size: 8px; font-weight: 800; }
  .file { height: ${GUTTER}px; align-items: start; padding-top: 3px; }
  .wrap { width: 86%; height: 86%; display: grid; place-items: center; }
  .wrap.pw { --piece-fill: var(--piece-light-fill); --piece-panel: var(--piece-light-panel); --piece-trim: var(--piece-light-trim); --piece-edge: var(--piece-light-edge); }
  .wrap.pb { --piece-fill: var(--piece-dark-fill); --piece-panel: var(--piece-dark-panel); --piece-trim: var(--piece-dark-trim); --piece-edge: var(--piece-dark-edge); }
  .carved { width: 100%; height: 100%; display: block; }
  .std { display: block; }
  .std svg { display: block; width: 100%; height: 100%; }
  .carved path { fill-rule: evenodd; stroke-linejoin: round; stroke-linecap: round; }
  .carved .body { fill: var(--piece-fill); stroke: var(--piece-edge); stroke-width: 2.6; }
  .carved .panel { fill: var(--piece-panel); }
  .carved .trim { fill: var(--piece-trim); }
  .chips { position: absolute; display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px 10px;
    padding-top: 12px; border-top: 1px solid #c9cec8; }
  .chip { display: grid; grid-template-columns: 12px 1fr; align-items: center; column-gap: 6px; height: 22px; }
  .chip i { grid-row: 1 / -1; width: 12px; height: 20px; border: 1px solid rgba(0, 0, 0, .45); }
  .chip b { font-size: 7px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; opacity: .66; }
  .chip code { font-size: 8px; letter-spacing: -.02em; }
  .note { font: 13px/1.5 Georgia, serif; opacity: .76; }
</style>
</head>
<body>
  <div class="sheet">
    <div class="sheet-head">
      <h1>Position Zero — board skins</h1>
      <span>from src/lib/themes.ts · ${THEMES.length} skins · ${CELL}px squares</span>
    </div>
    ${skins}
  </div>
</body>
</html>
`;

function pieceCard(camp: "w" | "b", symbol: keyof typeof PIECE_GEOMETRY["w"], label: string, left: number, top: number, size: number): string {
  const shape = PIECE_GEOMETRY[camp][symbol];
  const palette = resolvePalette(THEMES.find((t) => t.id === "auction")!, false);
  const material = camp === "w" ? palette.lightPiece : palette.darkPiece;
  const style = `--piece-body:${material.fill};--piece-panel:${material.panel};--piece-trim:${material.trim};--piece-edge:${material.edge}`;
  const layers = [
    `<path class="body" d="${shape.silhouette}"/>`,
    shape.panel ? `<path class="panel" d="${shape.panel}"/>` : "",
    shape.trim ? `<path class="trim" d="${shape.trim}"/>` : "",
  ].join("");
  return `<figure style="left:${left}px;top:${top}px;width:${size}px;${style}">
      <svg class="carved" viewBox="${PIECE_VIEW_BOX}" width="${size}" height="${size}">${layers}</svg>
      <figcaption>${label}</figcaption>
    </figure>`;
}

/** A large sheet of the twelve figures, so the reference pattern can be judged. */
function patternSheet(): string {
  const size = 196;
  const gapX = 12, gapY = 34, pad = 30;
  const columns = 6, rows = 2;
  const width = pad * 2 + columns * size + (columns - 1) * gapX;
  const height = pad + 76 + rows * (size + gapY) + pad;
  const cells = CAMPS.flatMap((camp, row) =>
    ORDER.map((symbol, column) => pieceCard(
      camp, symbol, `${camp === "w" ? "LIGHT" : "DARK"} · ${PIECE_LABELS[symbol]!.toUpperCase()}`,
      pad + column * (size + gapX), pad + 76 + row * (size + gapY), size)).join("\n    "));
  const palette = resolvePalette(THEMES.find((t) => t.id === "auction")!, false);
  const variables = Object.entries(boardCssVars(palette)).map(([name, value]) => `${name}: ${value};`).join(" ");
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><title>Position Zero — piece pattern</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  body { width: ${width}px; height: ${height}px; background: #6f7773; font: 10px "SFMono-Regular", Menlo, monospace; }
  .sheet { position: relative; width: ${width}px; height: ${height}px; ${variables} }
  h1 { position: absolute; left: ${pad}px; top: ${pad - 6}px; font: 600 26px Georgia, serif; color: #f2f4f2; }
  .sub { position: absolute; left: ${pad}px; top: ${pad + 32}px; color: #dfe4e0; letter-spacing: .16em; text-transform: uppercase; font-size: 10px; }
  figure { position: absolute; background: rgba(255, 255, 255, .06); border: 1px solid rgba(255, 255, 255, .22); }
  .carved { display: block; }
  .carved path { fill-rule: evenodd; stroke-linejoin: round; stroke-linecap: round; }
  .body { fill: var(--piece-body); stroke: var(--piece-edge); stroke-width: 2.6; }
  .panel { fill: var(--piece-panel); }
  .trim { fill: var(--piece-trim); }
  figcaption { padding: 5px 0 6px; text-align: center; color: #eef1ee; letter-spacing: .12em; font-size: 9px; }
</style></head>
<body><div class="sheet">
  <h1>Position Zero — piece pattern</h1>
  <span class="sub">traced from design/chess_set.png · auction skin materials · body / panel / gold</span>
  ${cells}
</div></body></html>
`;
}

const target = resolve("design/skins-preview.html");
writeFileSync(target, document);
console.log(`Wrote ${target} (${SHEET_W}x${SHEET_H} css px)`);

const patternTarget = resolve("design/pieces-pattern.html");
writeFileSync(patternTarget, patternSheet());
console.log(`Wrote ${patternTarget}`);
