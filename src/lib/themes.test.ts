import { describe, expect, it } from "vitest";
import {
  boardCssVars, contrastRatio, DEFAULT_THEME_ID, dimPalette, isThemeId, luminance, mixHex,
  normalizeHex, resolvePalette, resolveTheme, THEMES, weaveTexture, type BoardPalette,
} from "./themes";

const hexPattern = /^#[0-9a-f]{6}$/;

function eachPalette(): Array<{ name: string; palette: BoardPalette; carved: boolean }> {
  return THEMES.flatMap((theme) => [
    { name: `${theme.id} day`, palette: resolvePalette(theme, false), carved: theme.pieceArt.kind === "carved" },
    { name: `${theme.id} night`, palette: resolvePalette(theme, true), carved: theme.pieceArt.kind === "carved" },
  ]);
}

describe("board themes", () => {
  it("registers unique ids and resolves every id to itself", () => {
    const ids = THEMES.map((theme) => theme.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(isThemeId(DEFAULT_THEME_ID)).toBe(true);
    expect(isThemeId("walnut")).toBe(false);
    expect(isThemeId(null)).toBe(false);
    for (const id of ids) expect(resolveTheme(id).id).toBe(id);
  });

  it("keeps the mono skin byte-identical to the original hatch board", () => {
    const mono = resolveTheme("mono");
    const vars = boardCssVars(mono.day);
    expect(vars["--board-light"]).toBe("#ffffff");
    expect(vars["--board-dark"]).toBe("#ffffff");
    expect(vars["--board-light-texture"]).toBe("none");
    // The exact formula the board shipped with before skins existed.
    expect(vars["--board-dark-texture"])
      .toBe("repeating-linear-gradient(135deg, #ffffff 0 2px, #000000 2px 3px, #ffffff 3px 6px)");
    expect(vars["--board-frame-ink"]).toBe("#000000");
    expect(vars["--board-ink-light"]).toBe("#000000");
  });

  it("publishes every board variable as a colour or a texture", () => {
    for (const { name, palette } of eachPalette()) {
      const vars = boardCssVars(palette);
      expect(Object.keys(vars), name).toEqual([
        "--board-light", "--board-dark", "--board-light-texture", "--board-dark-texture",
        "--board-frame-surface", "--board-frame-line", "--board-frame-ink",
        "--board-ink-light", "--board-ink-dark",
        "--piece-light-fill", "--piece-light-panel", "--piece-light-trim", "--piece-light-edge",
        "--piece-dark-fill", "--piece-dark-panel", "--piece-dark-trim", "--piece-dark-edge",
      ]);
      for (const [token, value] of Object.entries(vars)) {
        if (token.endsWith("-texture")) expect(value, `${name} ${token}`).toMatch(/^(none|repeating-linear-gradient\()/);
        else expect(value, `${name} ${token}`).toMatch(hexPattern);
      }
    }
  });

  it("keeps coordinates, marks and pieces legible in every skin", () => {
    const failures: string[] = [];
    for (const { name, palette, carved } of eachPalette()) {
      const check = (label: string, foreground: string, background: string, minimum: number) => {
        const ratio = contrastRatio(foreground, background);
        if (ratio < minimum) failures.push(`${name} ${label}: ${ratio.toFixed(2)} < ${minimum}`);
      };
      // Rank and file labels sit on the mount.
      check("frame ink", palette.frameInk, palette.frameSurface, 4.5);
      // Selection, target and evidence marks are drawn per square parity.
      check("ink on light", palette.inkOnLight, palette.light, 3);
      check("ink on dark", palette.inkOnDark, palette.dark, 3);
      // Only the carved set is coloured by the palette; the standard set ships
      // its own black and white artwork and ignores these tokens.
      if (!carved) continue;
      // A piece reads if any of its materials separates from the square.
      for (const [side, material] of [["light piece", palette.lightPiece], ["dark piece", palette.darkPiece]] as const) {
        for (const [square, colour] of [["light square", palette.light], ["dark square", palette.dark]] as const) {
          const layers = [material.fill, material.panel, material.trim, material.edge];
          const best = Math.max(...layers.map((layer) => contrastRatio(layer, colour)));
          if (best < 3) {
            failures.push(`${name} ${side} on ${square}: best layer contrast ${best.toFixed(2)}`);
          }
        }
        // The pattern has to be visible against the body it sits on.
        const panelVsBody = contrastRatio(material.panel, material.fill);
        const trimVsBody = contrastRatio(material.trim, material.fill);
        if (panelVsBody < 1.15) failures.push(`${name} ${side}: panel barely differs from body (${panelVsBody.toFixed(2)})`);
        if (trimVsBody < 1.15) failures.push(`${name} ${side}: trim barely differs from body (${trimVsBody.toFixed(2)})`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("keeps the standard piece set everywhere except auction oxblood", () => {
    const porcelain = THEMES.filter((theme) => theme.pieceArt.kind === "porcelain").map((theme) => theme.id);
    expect(porcelain).toEqual(["auction"]);
    expect(resolveTheme("auction").pieceArt).toEqual({ kind: "porcelain", directory: "/pieces/red-black" });
    for (const theme of THEMES) {
      if (theme.pieceArt.kind === "standard") {
        expect(theme.pieceArt.directory, theme.id).toBe("/pieces/clker");
      }
    }
  });

  it("uses an explicit night palette instead of a derived one where provided", () => {
    for (const theme of THEMES) {
      const night = resolvePalette(theme, true);
      const day = resolvePalette(theme, false);
      if (theme.night) {
        expect(night.dark, theme.id).toBe(theme.night.dark ?? dimPalette(day).dark);
      }
      // Night never returns the daylight palette unchanged, and always darkens it.
      expect(night.light, theme.id).not.toBe(day.light);
      expect(luminance(night.light), theme.id).toBeLessThan(luminance(day.light));
    }
  });

  it("derives a dimmed palette for a skin without a night variant", () => {
    const daylight = resolveTheme("court").day;
    const dimmed = dimPalette(daylight);
    expect(luminance(dimmed.light)).toBeLessThan(luminance(daylight.light));
    expect(luminance(dimmed.dark)).toBeLessThan(luminance(daylight.dark));
    expect(dimmed.lightPiece).toEqual(daylight.lightPiece);
    expect(contrastRatio(dimmed.inkOnLight, dimmed.light)).toBeGreaterThan(3);
  });

  it("mixes and normalises hex colours", () => {
    expect(normalizeHex("#FFF")).toBe("#ffffff");
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mixHex("#000000", "#ffffff", 2)).toBe("#ffffff");
    expect(() => normalizeHex("rebeccapurple")).toThrow();
    expect(weaveTexture("#123456", null)).toBe("none");
    expect(weaveTexture("#123456", "#654321")).toContain("repeating-linear-gradient(135deg, #123456 0 2px, #654321 2px 3px, #123456 3px 6px)");
  });
});
