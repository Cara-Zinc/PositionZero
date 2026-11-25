import type { ReviewGrade, TrainingCard } from "../types";

const DAY_MS = 86_400_000;

export function scheduleReview(card: TrainingCard, grade: ReviewGrade, now = new Date()): TrainingCard {
  let intervalDays = card.intervalDays;
  let lapses = card.lapses;
  let dueAt: Date;
  if (grade === "again") {
    intervalDays = 0;
    lapses += 1;
    dueAt = new Date(now.getTime() + 10 * 60_000);
  } else if (grade === "hard") {
    intervalDays = Math.max(1, intervalDays * 1.2 || 1);
    dueAt = new Date(now.getTime() + intervalDays * DAY_MS);
  } else {
    intervalDays = Math.min(180, intervalDays > 0 ? intervalDays * 2.5 : 3);
    dueAt = new Date(now.getTime() + intervalDays * DAY_MS);
  }
  return {
    ...card,
    intervalDays,
    lapses,
    dueAt: dueAt.toISOString(),
    updatedAt: now.toISOString(),
  };
}
