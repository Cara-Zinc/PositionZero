/**
 * Board skins for Position Zero.
 *
 * A skin is pure data: two square surfaces, the mount they sit on, and the two
 * piece materials. Everything the board draws is derived from these tokens, so
 * a new colourway is one object literal rather than a stylesheet fork.
 *
 * The `auction` skin is taken from the reference chess set: parchment and
 * oxblood grounds with brass line-work, ivory bodies against gold-edged dark
 * bodies.
 */

export type ThemeId = "mono" | "auction" | "court" | "noir";

/**
 * Which drawing a skin uses for its pieces.
 *
 * `standard` is the Position Zero piece set archived in
 * `design/extracted-clker-chess` (mirrored into `public/pieces/clker`); the
 * artwork carries its own black and white, so those skins ignore the piece
 * material tokens below. `carved` is the set traced from `design/chess_set.png`
 * remains available for traced geometry. Auction oxblood uses the approved
 * red-and-black ImageGen artwork, shipped as transparent local PNG files.
 */
export type PieceArt =
  | { kind: "standard"; directory: string }
  | { kind: "porcelain"; directory: string }
  | { kind: "carved" };

/**
 * How one side's pieces are painted. The reference set designs each figure from
 * a primary material, a contrasting panel and gold work, so a piece keeps that
 * pattern: `fill` is the body, `panel` and `trim` are the overlay regions traced
 * from the sheet, and `edge` outlines the whole figure.
 */
export interface PieceMaterial {
  /** Primary material, filling the whole silhouette. */
  fill: string;
  /** Contrasting material of the camp, drawn over the body. */
  panel: string;
  /** Gold work, drawn over both. */
  trim: string;
  /** Outline around the silhouette; this is what keeps a piece readable on both square colours. */
  edge: string;
}

export interface BoardPalette {
  light: string;
  dark: string;
  /** Hairline woven into the light squares, or null for a plain surface. */
  lightWeave: string | null;
  /** Hairline woven into the dark squares, or null for a plain surface. */
  darkWeave: string | null;
  /** The mount the board is printed on; carries the rank and file labels. */
  frameSurface: string;
  /** Outer border and board edge rules. */
  frameLine: string;
  /** Coordinates, and the annotation ink used for engine arrows. */
  frameInk: string;
  /** Selection, target and evidence marks drawn on a light square. */
  inkOnLight: string;
  /** Selection, target and evidence marks drawn on a dark square. */
  inkOnDark: string;
  lightPiece: PieceMaterial;
  darkPiece: PieceMaterial;
}

export interface BoardTheme {
  id: ThemeId;
  label: string;
  /** Short material list, printed under the label in the picker. */
  caption: string;
  /** Where the colourway comes from; shown for the active skin. */
  note: string;
  pieceArt: PieceArt;
  day: BoardPalette;
  /** Explicit dark-room palette. Falls back to a derived dim when omitted. */
  night?: Partial<BoardPalette>;
}

export const DEFAULT_THEME_ID: ThemeId = "mono";

/** The standard piece set, served from `public/pieces/clker`. */
const STANDARD_ART: PieceArt = { kind: "standard", directory: "/pieces/clker" };
/** The set traced from the reference chess set; see pieceGeometry.ts. */
const PORCELAIN_ART: PieceArt = { kind: "porcelain", directory: "/pieces/red-black" };

/** Ink the derived night palette pulls every surface toward. */
const NIGHT_BASE = "#0c0e0d";

export const THEMES: readonly BoardTheme[] = [
  {
    id: "mono",
    label: "Mono hatch",
    caption: "Paper · ink · 45° hatch",
    note: "The original Position Zero board: hairline hatch instead of a solid dark square.",
    pieceArt: STANDARD_ART,
    day: {
      light: "#ffffff",
      dark: "#ffffff",
      lightWeave: null,
      darkWeave: "#000000",
      frameSurface: "#ffffff",
      frameLine: "#000000",
      frameInk: "#000000",
      inkOnLight: "#000000",
      inkOnDark: "#000000",
      lightPiece: { fill: "#ffffff", panel: "#dfe3e1", trim: "#a8aeab", edge: "#000000" },
      darkPiece: { fill: "#111111", panel: "#3a403d", trim: "#8b938f", edge: "#000000" },
    },
    night: {
      light: "#2b302e",
      dark: "#2b302e",
      darkWeave: "#000000",
      frameSurface: "#121615",
      frameLine: "#050706",
      frameInk: "#c9d3cd",
      inkOnLight: "#e4ebe7",
      inkOnDark: "#e4ebe7",
      // The hatched night board is a mid grey, so the dark camp needs a light
      // outline to stay readable on it.
      lightPiece: { fill: "#f2f4f2", panel: "#cfd5d2", trim: "#9aa29e", edge: "#000000" },
      darkPiece: { fill: "#2f3532", panel: "#4d5652", trim: "#8b938f", edge: "#e4ebe7" },
    },
  },
  {
    id: "auction",
    label: "Auction oxblood",
    caption: "Parchment · oxblood · brass",
    note: "Inspired by the Red and White reference set: red and black figures with ivory and gold work, led by the crowned sword-bearing Death king.",
    pieceArt: PORCELAIN_ART,
    day: {
      light: "#f2e4c9",
      dark: "#7e1116",
      lightWeave: "#e4d2ae",
      darkWeave: "#630c11",
      frameSurface: "#241a13",
      frameLine: "#a87c34",
      frameInk: "#d9a94e",
      inkOnLight: "#2a1c12",
      inkOnDark: "#f2d9a4",
      lightPiece: { fill: "#f7eedc", panel: "#8e1218", trim: "#d9a94e", edge: "#33241a" },
      darkPiece: { fill: "#1a1614", panel: "#e8dcc0", trim: "#c9a227", edge: "#e3b45e" },
    },
    night: {
      light: "#3b2e21",
      dark: "#5a0c10",
      lightWeave: "#33281c",
      darkWeave: "#45080b",
      frameSurface: "#17110c",
      frameLine: "#7a5a24",
      frameInk: "#d9a94e",
      inkOnLight: "#f0debc",
      inkOnDark: "#f2d9a4",
    },
  },
  {
    id: "court",
    label: "Court celadon",
    caption: "Porcelain · celadon · graphite",
    note: "A cool, quiet skin for long sessions: porcelain squares against muted celadon.",
    pieceArt: STANDARD_ART,
    day: {
      light: "#f1f3ec",
      dark: "#6e8b7b",
      lightWeave: "#e3e7dd",
      darkWeave: "#5e7b6b",
      frameSurface: "#e7eae1",
      frameLine: "#2b332e",
      frameInk: "#2b332e",
      inkOnLight: "#26302a",
      inkOnDark: "#f4f7f1",
      lightPiece: { fill: "#fbfcf7", panel: "#6e8b7b", trim: "#8fa79a", edge: "#2b332e" },
      darkPiece: { fill: "#4e6b5c", panel: "#eff4ee", trim: "#a8bcb1", edge: "#eff4ee" },
    },
    night: {
      light: "#2c332e",
      dark: "#44604f",
      lightWeave: "#262c28",
      darkWeave: "#3a5344",
      frameSurface: "#191e1a",
      frameLine: "#4a5a50",
      frameInk: "#c3d3c8",
      inkOnLight: "#e6ede7",
      inkOnDark: "#e6ede7",
    },
  },
  {
    id: "noir",
    label: "Noir lacquer",
    caption: "Charcoal · bone · brass",
    note: "A dark board that never dims: charcoal squares, bone pieces, brass rules.",
    pieceArt: STANDARD_ART,
    day: {
      light: "#54545d",
      dark: "#25252b",
      lightWeave: "#4a4a53",
      darkWeave: "#1d1d22",
      frameSurface: "#0f0f13",
      frameLine: "#8a7530",
      frameInk: "#d8c071",
      inkOnLight: "#f4f2ea",
      inkOnDark: "#f4f2ea",
      lightPiece: { fill: "#efebe0", panel: "#2a2a31", trim: "#c9a227", edge: "#14141a" },
      darkPiece: { fill: "#14141a", panel: "#cfcabb", trim: "#c9a227", edge: "#c9a227" },
    },
    night: {
      light: "#3e3e46",
      dark: "#1a1a1f",
      lightWeave: "#36363d",
      darkWeave: "#131317",
      frameSurface: "#08080a",
      frameLine: "#8a7530",
      frameInk: "#d8c071",
      inkOnLight: "#efede6",
      inkOnDark: "#efede6",
    },
  },
];

export function resolveTheme(id: ThemeId): BoardTheme {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0]!;
}

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEMES.some((theme) => theme.id === value);
}

function channels(hex: string): [number, number, number] {
  const raw = hex.trim().replace(/^#/, "");
  const full = raw.length === 3 ? raw.split("").map((digit) => digit + digit).join("") : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`Not a hex colour: ${hex}`);
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

export function normalizeHex(hex: string): string {
  const [r, g, b] = channels(hex);
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

/** Blend two hex colours; `amount` is how much of `to` is mixed in. */
export function mixHex(from: string, to: string, amount: number): string {
  const [r1, g1, b1] = channels(from);
  const [r2, g2, b2] = channels(to);
  const ratio = Math.min(1, Math.max(0, amount));
  const mix = (a: number, b: number) => Math.round(a + (b - a) * ratio);
  return `#${[mix(r1, r2), mix(g1, g2), mix(b1, b2)]
    .map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

/** WCAG relative luminance, used to keep every skin legible. */
export function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (high + 0.05) / (low + 0.05);
}

/** Pull a daylight palette into a dark room without losing its identity. */
export function dimPalette(palette: BoardPalette): BoardPalette {
  return {
    ...palette,
    light: mixHex(palette.light, NIGHT_BASE, 0.78),
    dark: mixHex(palette.dark, NIGHT_BASE, 0.72),
    lightWeave: palette.lightWeave ? mixHex(palette.lightWeave, NIGHT_BASE, 0.72) : null,
    darkWeave: palette.darkWeave ? mixHex(palette.darkWeave, NIGHT_BASE, 0.6) : null,
    frameSurface: mixHex(palette.frameSurface, NIGHT_BASE, 0.5),
    frameLine: mixHex(palette.frameLine, "#ffffff", 0.28),
    frameInk: mixHex(palette.frameInk, "#ffffff", 0.32),
    inkOnLight: mixHex(palette.inkOnLight, "#ffffff", 0.72),
    inkOnDark: mixHex(palette.inkOnDark, "#ffffff", 0.32),
  };
}

export function resolvePalette(theme: BoardTheme, inverted: boolean): BoardPalette {
  if (!inverted) return theme.day;
  return { ...dimPalette(theme.day), ...theme.night };
}

/**
 * The legacy dark square: a 45° hatch of 1px ink every 6px over the square
 * colour. Every skin reuses this rhythm so a woven skin still reads as fabric.
 */
export function weaveTexture(base: string, weave: string | null): string {
  if (!weave) return "none";
  const [surface, line] = [normalizeHex(base), normalizeHex(weave)];
  return `repeating-linear-gradient(135deg, ${surface} 0 2px, ${line} 2px 3px, ${surface} 3px 6px)`;
}

export function boardCssVars(palette: BoardPalette): Record<string, string> {
  return {
    "--board-light": normalizeHex(palette.light),
    "--board-dark": normalizeHex(palette.dark),
    "--board-light-texture": weaveTexture(palette.light, palette.lightWeave),
    "--board-dark-texture": weaveTexture(palette.dark, palette.darkWeave),
    "--board-frame-surface": normalizeHex(palette.frameSurface),
    "--board-frame-line": normalizeHex(palette.frameLine),
    "--board-frame-ink": normalizeHex(palette.frameInk),
    "--board-ink-light": normalizeHex(palette.inkOnLight),
    "--board-ink-dark": normalizeHex(palette.inkOnDark),
    "--piece-light-fill": normalizeHex(palette.lightPiece.fill),
    "--piece-light-panel": normalizeHex(palette.lightPiece.panel),
    "--piece-light-trim": normalizeHex(palette.lightPiece.trim),
    "--piece-light-edge": normalizeHex(palette.lightPiece.edge),
    "--piece-dark-fill": normalizeHex(palette.darkPiece.fill),
    "--piece-dark-panel": normalizeHex(palette.darkPiece.panel),
    "--piece-dark-trim": normalizeHex(palette.darkPiece.trim),
    "--piece-dark-edge": normalizeHex(palette.darkPiece.edge),
  };
}
