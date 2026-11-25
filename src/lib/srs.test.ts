import { describe, expect, it } from "vitest";
import type { TrainingCard } from "../types";
import { scheduleReview } from "./srs";

const NOW = new Date("2026-08-15T00:00:00.000Z");
const CARD: TrainingCard = {
  id: "c", studyId: "s", promptFen: "fen", acceptedMoves: ["e2e4"],
  forcingLine: ["e2e4"], motifTags: ["FORK"], dueAt: NOW.toISOString(),
  intervalDays: 4, lapses: 0, createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(),
};

describe("review scheduling", () => {
  it("returns Again in ten minutes and counts a lapse", () => {
    const next = scheduleReview(CARD, "again", NOW);
    expect(next.dueAt).toBe("2026-08-15T00:10:00.000Z");
    expect(next.intervalDays).toBe(0);
    expect(next.lapses).toBe(1);
  });

  it("uses the fixed Hard and Good multipliers", () => {
    expect(scheduleReview(CARD, "hard", NOW).intervalDays).toBeCloseTo(4.8);
    expect(scheduleReview(CARD, "good", NOW).intervalDays).toBe(10);
    expect(scheduleReview({ ...CARD, intervalDays: 0 }, "good", NOW).intervalDays).toBe(3);
  });
});
