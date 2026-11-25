import { useSyncExternalStore } from "react";
import {
  boardCssVars, DEFAULT_THEME_ID, isThemeId, type BoardPalette, type ThemeId,
} from "./themes";

export const THEME_STORAGE_KEY = "position-zero.appearance.board";

const listeners = new Set<() => void>();

/** Reads the persisted skin, falling back to the default for anything unknown. */
export function readStoredTheme(): ThemeId {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(stored) ? stored : DEFAULT_THEME_ID;
  } catch {
    return DEFAULT_THEME_ID;
  }
}

let activeTheme: ThemeId = readStoredTheme();

export function getThemeId(): ThemeId {
  return activeTheme;
}

/** Select a skin. Every subscribed board re-renders; the choice survives a restart. */
export function setThemeId(id: ThemeId): void {
  if (!isThemeId(id) || id === activeTheme) return;
  activeTheme = id;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    // A blocked storage quota must not stop the board from changing appearance.
  }
  for (const listener of listeners) listener();
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Drop back to the default skin in memory. Used by tests, not by the UI. */
export function resetThemeId(): void {
  activeTheme = DEFAULT_THEME_ID;
  for (const listener of listeners) listener();
}

export function useThemeId(): ThemeId {
  return useSyncExternalStore(subscribeTheme, getThemeId, () => DEFAULT_THEME_ID);
}

/**
 * Write a palette onto an element as custom properties. The board only ever
 * reads these variables, so a skin swap is a single style recalculation with no
 * component tree churn.
 */
export function applyBoardVariables(palette: BoardPalette, target: HTMLElement): void {
  const variables = boardCssVars(palette);
  for (const [name, value] of Object.entries(variables)) target.style.setProperty(name, value);
}
