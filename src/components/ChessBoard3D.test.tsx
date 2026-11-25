import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Chess } from "chess.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChessBoard3D } from "./ChessBoard3D";

vi.mock("three", async importOriginal => {
  const original = await importOriginal<typeof import("three")>();
  return { ...original, WebGLRenderer: class { constructor() { throw new Error("No WebGL in test"); } } };
});

afterEach(cleanup);
describe("3D board interaction and fallback", () => {
  it("provides a visible 2D fallback when WebGL is unavailable", () => {
    const fallback = vi.fn();
    render(<ChessBoard3D fen={new Chess().fen()} onFallback={fallback} />);
    expect(screen.getByText(/无法启动 WebGL/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "返回 2D" }));
    expect(fallback).toHaveBeenCalledOnce();
  });
  it("uses the same move callback and clears selection after an accepted move", () => {
    const onMove = vi.fn(() => true);
    render(<ChessBoard3D fen={new Chess().fen()} onFallback={() => {}} onMove={onMove} />);
    fireEvent.click(screen.getByRole("gridcell", { name: "e2, white pawn" }));
    fireEvent.click(screen.getByRole("gridcell", { name: "e4" }));
    expect(onMove).toHaveBeenCalledWith("e2", "e4");
    expect(screen.getByRole("gridcell", { name: "e2, white pawn" })).toHaveAttribute("aria-selected", "false");
  });
  it("rejects illegal moves and resets stale selection when FEN changes", () => {
    const onMove = vi.fn();
    const chess = new Chess();
    const { rerender } = render(<ChessBoard3D fen={chess.fen()} onFallback={() => {}} onMove={onMove} />);
    fireEvent.click(screen.getByRole("gridcell", { name: "e2, white pawn" }));
    fireEvent.click(screen.getByRole("gridcell", { name: "e5" }));
    expect(onMove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("gridcell", { name: "e2, white pawn" }));
    chess.move("d4");
    rerender(<ChessBoard3D fen={chess.fen()} onFallback={() => {}} onMove={onMove} />);
    expect(screen.getByRole("gridcell", { name: "e2, white pawn" })).toHaveAttribute("aria-selected", "false");
  });
  it("respects disabled mode and flips keyboard square order", () => {
    render(<ChessBoard3D fen={new Chess().fen()} orientation="b" disabled onFallback={() => {}} />);
    expect(screen.getAllByRole("gridcell")[0]).toHaveAccessibleName("h1, white rook");
    expect(screen.getByRole("gridcell", { name: "e2, white pawn" })).toBeDisabled();
  });
});
