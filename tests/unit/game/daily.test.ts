import { describe, expect, it } from "vitest";
import { dailyGrid, dateForPuzzle, msUntilNextPuzzle, periodKeys, puzzleNumberFor } from "@/game/daily";
import type { Schedule } from "@/game/types";

const LAUNCH = "2026-11-01";

describe("puzzleNumberFor", () => {
  it("is 1 on launch day and increments at 00:00 UTC", () => {
    expect(puzzleNumberFor(new Date("2026-11-01T00:00:00Z"), LAUNCH)).toBe(1);
    expect(puzzleNumberFor(new Date("2026-11-01T23:59:59.999Z"), LAUNCH)).toBe(1);
    expect(puzzleNumberFor(new Date("2026-11-02T00:00:00Z"), LAUNCH)).toBe(2);
  });

  it("depends only on the UTC date, not the local offset", () => {
    // 2026-11-05 22:30 in UTC-3 and 2026-11-06 07:30 in UTC+9 are both 2026-11-06 01:30Z
    const a = new Date("2026-11-05T22:30:00-03:00");
    const b = new Date("2026-11-06T10:30:00+09:00");
    expect(puzzleNumberFor(a, LAUNCH)).toBe(6);
    expect(puzzleNumberFor(b, LAUNCH)).toBe(6);
  });

  it("is ≤ 0 before launch", () => {
    expect(puzzleNumberFor(new Date("2026-10-31T12:00:00Z"), LAUNCH)).toBe(0);
  });

  it("round-trips with dateForPuzzle across month boundaries", () => {
    expect(dateForPuzzle(31, LAUNCH)).toBe("2026-12-01");
    expect(puzzleNumberFor(new Date(`${dateForPuzzle(61, LAUNCH)}T05:00:00Z`), LAUNCH)).toBe(61);
  });
});

describe("dailyGrid", () => {
  const schedule: Schedule = {
    launchDate: LAUNCH,
    puzzles: [{ puzzleNumber: 1, date: LAUNCH, rows: ["a", "b", "c"], cols: ["d", "e", "f"] }],
  };

  it("returns the scheduled grid or null", () => {
    expect(dailyGrid(schedule, 1)).toEqual({
      rows: ["a", "b", "c"],
      cols: ["d", "e", "f"],
      kind: "daily",
      puzzleNumber: 1,
    });
    expect(dailyGrid(schedule, 2)).toBeNull();
  });
});

describe("msUntilNextPuzzle", () => {
  it("counts down to the next UTC midnight", () => {
    expect(msUntilNextPuzzle(new Date("2026-11-01T23:59:59Z"))).toBe(1000);
    expect(msUntilNextPuzzle(new Date("2026-11-01T00:00:00Z"))).toBe(86_400_000);
  });
});

describe("periodKeys", () => {
  it("uses ISO weeks (Monday start) and calendar months in UTC", () => {
    expect(periodKeys(new Date("2026-10-29T12:00:00Z"))).toEqual({ week: "2026-W44", month: "2026-10" });
    expect(periodKeys(new Date("2026-11-01T23:59:59Z"))).toEqual({ week: "2026-W44", month: "2026-11" });
    expect(periodKeys(new Date("2026-11-02T00:00:00Z")).week).toBe("2026-W45");
  });

  it("assigns year-boundary weeks to the ISO week-year", () => {
    expect(periodKeys(new Date("2000-01-01T00:00:00Z"))).toEqual({ week: "1999-W52", month: "2000-01" });
    expect(periodKeys(new Date("2021-01-03T00:00:00Z")).week).toBe("2020-W53");
    expect(periodKeys(new Date("2024-12-30T00:00:00Z")).week).toBe("2025-W01");
  });

  it("depends only on the UTC date", () => {
    expect(periodKeys(new Date("2026-11-01T22:00:00-03:00"))).toEqual({ week: "2026-W45", month: "2026-11" });
  });
});
