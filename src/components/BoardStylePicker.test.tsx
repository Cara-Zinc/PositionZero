import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BoardStylePicker } from "./BoardStylePicker";
import { getThemeId, resetThemeId } from "../lib/appearance";
import { THEMES } from "../lib/themes";

describe("BoardStylePicker", () => {
  afterEach(() => {
    cleanup();
    resetThemeId();
    window.localStorage.clear();
  });

  it("lists every skin, then dresses the board in the chosen one", () => {
    render(<BoardStylePicker inverted={false} />);
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Board skin:/ }));

    const options = screen.getAllByRole("radio");
    expect(options).toHaveLength(THEMES.length);
    expect(screen.getByRole("radio", { name: /Mono hatch/i })).toHaveAttribute("aria-checked", "true");

    fireEvent.click(screen.getByRole("radio", { name: /Auction oxblood/i }));

    expect(getThemeId()).toBe("auction");
    expect(screen.getByRole("radio", { name: /Auction oxblood/i })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /Mono hatch/i })).toHaveAttribute("aria-checked", "false");
    // The panel stays open so skins can be compared, and narrates the active one.
    expect(screen.getByRole("dialog", { name: "Board skin" })).toHaveTextContent(/reference set/i);
  });

  it("closes on Escape and on a request from outside the panel", () => {
    render(<BoardStylePicker inverted={false} />);
    const trigger = screen.getByRole("button", { name: /^Board skin:/ });

    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Board skin" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Board skin" })).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog", { name: "Board skin" })).not.toBeInTheDocument();
  });

  it("previews each skin with its own squares and piece geometry", () => {
    render(<BoardStylePicker inverted={false} />);
    fireEvent.click(screen.getByRole("button", { name: /^Board skin:/ }));

    // Two pieces per swatch, plus two in the trigger. Oxblood previews PNG art.
    const porcelain = THEMES.filter((theme) => theme.pieceArt.kind === "porcelain").length;
    expect(porcelain).toBe(1);
    expect(document.querySelectorAll("img.chess-piece-porcelain")).toHaveLength(porcelain * 2);
    expect(document.querySelectorAll("img.chess-piece-standard"))
      .toHaveLength((THEMES.length - porcelain) * 2 + 2);

    // A preview carries the previewed palette, not the active one.
    const auction = screen.getByRole("radio", { name: /Auction oxblood/i });
    const swatch = auction.querySelector<HTMLElement>(".skin-swatch");
    expect(swatch?.style.getPropertyValue("--board-light")).toBe("#f2e4c9");
    expect(swatch?.style.getPropertyValue("--board-dark")).toBe("#7e1116");
    expect(swatch?.style.getPropertyValue("--piece-dark-edge")).toBe("#e3b45e");
  });
});
