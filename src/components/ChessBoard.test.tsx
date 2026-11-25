import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChessBoard } from "./ChessBoard";
import { Chess } from "chess.js";
import { resetThemeId, setThemeId } from "../lib/appearance";
import { PIECE_GEOMETRY } from "../lib/pieceGeometry";

describe("ChessBoard", () => {
  afterEach(() => {
    cleanup();
    resetThemeId();
    window.localStorage.clear();
  });

  it("allows a legal click-to-move sequence", () => {
    const onMove = vi.fn(() => true);
    render(<ChessBoard fen={new Chess().fen()} onMove={onMove} />);
    fireEvent.click(screen.getByRole("gridcell", { name: /e2, white pawn/i }));
    fireEvent.click(screen.getByRole("gridcell", { name: /^e4$/i }));
    expect(onMove).toHaveBeenCalledWith("e2", "e4");
  });

  it("renders file and rank coordinates and mirrors them when flipped", () => {
    const { rerender } = render(<ChessBoard fen={new Chess().fen()} />);
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    rerender(<ChessBoard fen={new Chess().fen()} orientation="b" />);
    expect(screen.getByText("H")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("ships the standard piece set by default", () => {
    render(<ChessBoard fen={new Chess().fen()} />);
    // design/extracted-clker-chess is the standard artwork, served as files.
    expect(screen.getByRole("gridcell", { name: /e2, white pawn/i }).querySelector("img"))
      .toHaveAttribute("src", "/pieces/clker/white-pawn.svg");
    expect(screen.getByRole("gridcell", { name: /b8, black knight/i }).querySelector("img"))
      .toHaveAttribute("src", "/pieces/clker/black-knight.svg");
    expect(document.querySelector("svg.chess-piece-carved")).toBeNull();
  });

  it("swaps in the red-and-black PNG set only for auction oxblood", () => {
    setThemeId("auction");
    render(<ChessBoard fen={new Chess().fen()} />);

    const king = screen.getByRole("gridcell", { name: /e1, white king/i });
    expect(king.querySelector("img")).toHaveAttribute("src", "/pieces/red-black/white-king.png");
    expect(king.querySelector("img")).toHaveAttribute("draggable", "false");
    expect(king.querySelector("svg")).toBeNull();

    const knight = screen.getByRole("gridcell", { name: /b8, black knight/i });
    expect(knight.querySelector("img")).toHaveAttribute("src", "/pieces/red-black/black-knight.png");
    expect(screen.getByRole("gridcell", { name: /e8, black king/i }).querySelector("img"))
      .toHaveAttribute("src", "/pieces/red-black/black-king.png");
    expect(document.querySelectorAll("img.chess-piece-porcelain")).toHaveLength(32);
  });

  it("gives the two camps different outlines on the same square count", () => {
    // The reference sheet designs one row per camp, so the two camps carry
    // different art rather than one silhouette in two colours.
    expect(PIECE_GEOMETRY.w.k.silhouette).not.toBe(PIECE_GEOMETRY.b.k.silhouette);
    expect(Object.keys(PIECE_GEOMETRY.w)).toHaveLength(6);
    expect(Object.keys(PIECE_GEOMETRY.b)).toHaveLength(6);
  });

  it("restores the original artwork when switching away from oxblood", () => {
    setThemeId("auction");
    const { rerender } = render(<ChessBoard fen={new Chess().fen()} />);
    const king = screen.getByRole("gridcell", { name: /e1, white king/i });
    expect(king.querySelector("img")).toHaveAttribute("src", "/pieces/red-black/white-king.png");
    setThemeId("mono");
    rerender(<ChessBoard fen={new Chess().fen()} />);
    expect(king.querySelector("img")).toHaveAttribute("src", "/pieces/clker/white-king.svg");
    expect(document.querySelectorAll("img.chess-piece-porcelain")).toHaveLength(0);
  });

  it("offers skins that keep the standard set", () => {
    for (const standard of ["mono", "court", "noir"] as const) {
      setThemeId(standard);
      const { unmount } = render(<ChessBoard fen={new Chess().fen()} />);
      expect(document.querySelectorAll("svg.chess-piece-carved"), standard).toHaveLength(0);
      expect(document.querySelectorAll("img.chess-piece-standard").length, standard).toBeGreaterThan(0);
      unmount();
    }
  });

  it("paints the corners the way a real board does", () => {
    render(<ChessBoard fen={new Chess().fen()} />);
    // a1 is a dark square and h1 is a light one; each parity gets its own ink
    // token in the stylesheet so marks stay visible on a saturated skin.
    expect(screen.getByRole("gridcell", { name: /^a1/ }).className).toContain("is-dark");
    expect(screen.getByRole("gridcell", { name: /^h1/ }).className).toContain("is-light");
    expect(screen.getByRole("gridcell", { name: /^a8/ }).className).toContain("is-light");
    expect(screen.getByRole("gridcell", { name: /^h8/ }).className).toContain("is-dark");
  });

  it("contains a stale-position move error without crashing", () => {
    const onMove = vi.fn(() => { throw new Error("Invalid move"); });
    render(<ChessBoard fen={new Chess().fen()} onMove={onMove} />);

    fireEvent.click(screen.getByRole("gridcell", { name: /e2, white pawn/i }));
    expect(() => fireEvent.click(screen.getByRole("gridcell", { name: /^e4$/i }))).not.toThrow();
    expect(onMove).toHaveBeenCalledWith("e2", "e4");
  });
});
