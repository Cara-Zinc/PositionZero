import { describe, expect, it } from "vitest";
import type { AnalysisLine } from "../types";
import { explainLine, expectation } from "./coach";

function line(overrides: Partial<AnalysisLine>): AnalysisLine {
  return { rank: 1, scoreCp: 0, mateIn: null, wdl: null, depth: 18, selDepth: 24,
    nodes: 1000, nps: 1000, hashFull: 0, pvUci: [], ...overrides };
}

describe("verifiable coach", () => {
  it("labels a forced mate without inventing a strategic reason", () => {
    const insight = explainLine("4k3/8/8/8/8/8/4Q3/4K3 w - - 0 1", line({ mateIn: 3, pvUci: ["e2b5", "e8e7"] }));
    expect(insight.motif).toBe("FORCING MATE");
    expect(insight.confidence).toBeGreaterThan(0.9);
  });

  it("normalizes WDL to win expectation", () => {
    expect(expectation(line({ wdl: { win: 400, draw: 400, loss: 200 } }))).toBeCloseTo(0.6);
  });
});
