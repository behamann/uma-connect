import { CELL_COUNT, type HistoryEntry, type PlayerStatistics } from "./types";

/** Statistics are derived from history (never stored) so they cannot drift. */
export function computeStats(history: HistoryEntry[], todayPuzzle: number): PlayerStatistics {
  const byPuzzle = new Map(history.map((h) => [h.puzzleNumber, h]));
  const numbers = [...byPuzzle.keys()].sort((a, b) => a - b);
  const entries = numbers.map((n) => byPuzzle.get(n)!);

  let best = 0;
  let run = 0;
  numbers.forEach((n, i) => {
    run = i > 0 && n === numbers[i - 1]! + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  const latest = numbers.at(-1);
  const current = latest !== undefined && latest >= todayPuzzle - 1 ? run : 0;

  const played = entries.length;
  const total = entries.reduce((sum, h) => sum + h.score, 0);
  return {
    played,
    averageScore: played ? total / played : 0,
    perfect: entries.filter((h) => h.score === CELL_COUNT).length,
    currentStreak: current,
    bestStreak: best,
  };
}
