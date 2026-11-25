import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AnalysisLine, EngineStatus } from "../types";
import { AnalysisPanel } from "./AnalysisPanel";

const status: EngineStatus = {
  state: "ready",
  engineName: "Stockfish 18",
  currentJobId: null,
  message: null,
};

const line: AnalysisLine = {
  rank: 1,
  scoreCp: 34,
  mateIn: null,
  wdl: { win: 300, draw: 600, loss: 100 },
  depth: 16,
  selDepth: 22,
  nodes: 120_000,
  nps: 800_000,
  hashFull: 12,
  pvUci: ["e2e4", "e7e5"],
};

describe("AnalysisPanel", () => {
  afterEach(cleanup);

  it("lets the user apply the first move of a candidate line", () => {
    const onPlayMove = vi.fn();
    render(
      <AnalysisPanel
        status={status}
        lines={[line]}
        insight={null}
        activeProfile="quick"
        onDeepen={vi.fn()}
        onPlayMove={onPlayMove}
        onRestart={vi.fn()}
        onMakeCard={vi.fn()}
        canMakeCard={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /play move/i }));
    expect(onPlayMove).toHaveBeenCalledWith("e2e4");
  });
});
