import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyBoardVariables, getThemeId, readStoredTheme, resetThemeId, setThemeId, subscribeTheme,
  THEME_STORAGE_KEY,
} from "./appearance";
import { DEFAULT_THEME_ID, resolvePalette, resolveTheme } from "./themes";

describe("board skin store", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetThemeId();
  });

  it("starts on the default skin and persists a selection", () => {
    expect(getThemeId()).toBe(DEFAULT_THEME_ID);
    setThemeId("auction");
    expect(getThemeId()).toBe("auction");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("auction");
  });

  it("notifies subscribers once per actual change and can unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeTheme(listener);
    setThemeId("court");
    setThemeId("court");
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    setThemeId("noir");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("refuses ids that are not registered skins", () => {
    setThemeId("walnut" as never);
    expect(getThemeId()).toBe(DEFAULT_THEME_ID);
  });

  it("reads a stored skin defensively", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "court");
    expect(readStoredTheme()).toBe("court");
    window.localStorage.setItem(THEME_STORAGE_KEY, "definitely-not-a-skin");
    expect(readStoredTheme()).toBe(DEFAULT_THEME_ID);
    window.localStorage.removeItem(THEME_STORAGE_KEY);
    expect(readStoredTheme()).toBe(DEFAULT_THEME_ID);
  });

  it("writes the whole palette onto a target element", () => {
    const target = document.createElement("div");
    applyBoardVariables(resolvePalette(resolveTheme("auction"), false), target);
    expect(target.style.getPropertyValue("--board-light")).toBe("#f2e4c9");
    expect(target.style.getPropertyValue("--board-dark")).toBe("#7e1116");
    expect(target.style.getPropertyValue("--piece-dark-edge")).toBe("#e3b45e");
    expect(target.style.getPropertyValue("--board-light-texture")).toContain("repeating-linear-gradient");
  });
});
