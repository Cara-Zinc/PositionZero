import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ImportedMove } from "../types";
import { AnalysisTimeline } from "./AnalysisTimeline";

const move: ImportedMove = {
  ply: 1,
  color: "w",
  san: "e4",
  uci: "e2e4",
  fenBefore: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  fenAfter: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
  comments: [],
  nags: [],
};

describe("AnalysisTimeline", () => {
  afterEach(cleanup);

  it("navigates backward and forward through recorded positions", () => {
    const onNavigate = vi.fn();
    const { rerender } = render(<AnalysisTimeline moves={[move]} cursor={1} evaluations={{}} onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole("button", { name: /previous position/i }));
    expect(onNavigate).toHaveBeenCalledWith(0);

    rerender(<AnalysisTimeline moves={[move]} cursor={0} evaluations={{}} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("button", { name: /next position/i }));
    expect(onNavigate).toHaveBeenCalledWith(1);
  });

  it("explains that continuing from history replaces the later path", () => {
    render(<AnalysisTimeline moves={[move]} cursor={0} evaluations={{}} onNavigate={vi.fn()} />);
    expect(screen.getByText(/replaces 1 later ply/i)).toBeInTheDocument();
  });
});
