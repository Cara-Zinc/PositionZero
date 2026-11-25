import { useEffect, useRef, useState, type CSSProperties } from "react";
import { setThemeId, useThemeId } from "../lib/appearance";
import { boardCssVars, resolvePalette, THEMES, type BoardTheme } from "../lib/themes";
import { PieceGlyph } from "./ChessBoard";

/**
 * The dressing room. Each row previews a skin with the real board surfaces and
 * the real piece renderer, so the swatch cannot drift from what the board does.
 */
function SkinSwatch({ theme, inverted }: { theme: BoardTheme; inverted: boolean }) {
  const palette = resolvePalette(theme, inverted);
  return (
    <span className="skin-swatch" style={boardCssVars(palette) as CSSProperties} aria-hidden="true">
      <span className="skin-square is-light"><span className="skin-piece piece-w"><PieceGlyph type="n" color="w" themeId={theme.id} /></span></span>
      <span className="skin-square is-dark" />
      <span className="skin-square is-dark" />
      <span className="skin-square is-light"><span className="skin-piece piece-b"><PieceGlyph type="n" color="b" themeId={theme.id} /></span></span>
    </span>
  );
}

export function BoardStylePicker({ inverted }: { inverted: boolean }) {
  const activeId = useThemeId();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const active = THEMES.find((theme) => theme.id === activeId) ?? THEMES[0]!;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Hand focus back to the trigger instead of dropping it on <body>.
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLButtonElement>('[role="radio"][aria-checked="true"]')?.focus();
  }, [open]);

  return (
    <div className="skin-picker" ref={panelRef}>
      <button
        type="button"
        ref={triggerRef}
        className="skin-trigger"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Board skin: ${active.label}`}
        title={`Board skin — ${active.label}`}
        onClick={() => setOpen((value) => !value)}
      >
        <SkinSwatch theme={active} inverted={inverted} />
      </button>

      {open && (
        <div className="skin-panel" role="dialog" aria-label="Board skin">
          <div className="skin-panel-head">
            <span className="eyebrow">BOARD SKIN</span>
            <button type="button" className="skin-dismiss" onClick={() => setOpen(false)} aria-label="Close board skin">×</button>
          </div>
          <div className="skin-options" role="radiogroup" aria-label="Board skins">
            {THEMES.map((theme) => {
              const checked = theme.id === activeId;
              return (
                <button
                  type="button"
                  key={theme.id}
                  role="radio"
                  aria-checked={checked}
                  className={checked ? "skin-option is-active" : "skin-option"}
                  onClick={() => setThemeId(theme.id)}
                >
                  <SkinSwatch theme={theme} inverted={inverted} />
                  <span className="skin-option-meta">
                    <strong>{theme.label}</strong>
                    <small>{theme.caption}</small>
                  </span>
                  <span className="skin-option-mark" aria-hidden="true">{checked ? "●" : "○"}</span>
                </button>
              );
            })}
          </div>
          <p className="skin-note">{active.note}</p>
        </div>
      )}
    </div>
  );
}
