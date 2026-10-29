import type { Grid, Schedule } from "./types";

const DAY_MS = 86_400_000;

function parseIsoDate(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y ?? NaN, (m ?? NaN) - 1, d ?? NaN);
}

function startOfUtcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function toIsoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Puzzle #1 is on `launchDate`; the number increments at 00:00 UTC. May be ≤ 0 before launch. */
export function puzzleNumberFor(dateUtc: Date, launchDate: string): number {
  return Math.round((startOfUtcDay(dateUtc) - parseIsoDate(launchDate)) / DAY_MS) + 1;
}

export function dateForPuzzle(puzzleNumber: number, launchDate: string): string {
  return toIsoDate(parseIsoDate(launchDate) + (puzzleNumber - 1) * DAY_MS);
}

export function dailyGrid(schedule: Schedule, puzzleNumber: number): Grid | null {
  const entry = schedule.puzzles.find((p) => p.puzzleNumber === puzzleNumber);
  return entry ? { rows: entry.rows, cols: entry.cols, kind: "daily", puzzleNumber } : null;
}

export function msUntilNextPuzzle(now: Date): number {
  return startOfUtcDay(now) + DAY_MS - now.getTime();
}

/** Leaderboard period keys for a UTC date: ISO week (`2026-W44`) and month (`2026-10`). */
export function periodKeys(now: Date): { week: string; month: string } {
  const day = startOfUtcDay(now);
  const weekday = (new Date(day).getUTCDay() + 6) % 7;
  const thursday = day + (3 - weekday) * DAY_MS;
  const year = new Date(thursday).getUTCFullYear();
  const week = Math.floor((thursday - Date.UTC(year, 0, 1)) / (7 * DAY_MS)) + 1;
  return { week: `${year}-W${String(week).padStart(2, "0")}`, month: toIsoDate(day).slice(0, 7) };
}
