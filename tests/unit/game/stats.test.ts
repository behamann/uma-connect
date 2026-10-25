import { describe, expect, it } from "vitest";
import { computeStats } from "@/game/stats";
import type { HistoryEntry } from "@/game/types";

const h = (puzzleNumber: number, score: number): HistoryEntry => ({
  puzzleNumber,
  score,
  status: score === 9 ? "completed" : "out_of_guesses",
});

describe("computeStats", () => {
  it("is all zeros without history", () => {
    expect(computeStats([], 10)).toEqual({
      played: 0,
      averageScore: 0,
      perfect: 0,
      currentStreak: 0,
      bestStreak: 0,
    });
  });

  it("counts 3 consecutive days as a streak of 3", () => {
    const s = computeStats([h(1, 9), h(2, 6), h(3, 3)], 3);
    expect(s).toEqual({ played: 3, averageScore: 6, perfect: 1, currentStreak: 3, bestStreak: 3 });
  });

  it("resets the current streak after a gap but keeps the best", () => {
    const s = computeStats([h(1, 5), h(2, 5), h(3, 5), h(5, 5)], 5);
    expect(s.currentStreak).toBe(1);
    expect(s.bestStreak).toBe(3);
  });

  it("keeps the streak alive until today's puzzle is missed", () => {
    expect(computeStats([h(1, 5), h(2, 5)], 3).currentStreak).toBe(2);
    expect(computeStats([h(1, 5), h(2, 5)], 4).currentStreak).toBe(0);
  });

  it("ignores duplicate and unsorted entries", () => {
    const s = computeStats([h(3, 1), h(1, 1), h(2, 1), h(2, 1)], 3);
    expect(s.played).toBe(3);
    expect(s.currentStreak).toBe(3);
  });
});
