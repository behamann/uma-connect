import { describe, expect, it } from "vitest";
import { cellRarity, rarityScore, type RarityData } from "@/game/rarity";

const data: RarityData = {
  finishedGames: 40,
  cells: [
    { cell: 0, traineeId: "a", picks: 10 },
    { cell: 0, traineeId: "b", picks: 1 },
    { cell: 4, traineeId: "c", picks: 3 },
  ],
};

describe("cellRarity", () => {
  it("is the share of finished games that picked the answer", () => {
    expect(cellRarity(data, 0, "a")).toBe(25);
    expect(cellRarity(data, 0, "b")).toBe(2.5);
  });

  it("counts empty or wrong cells as 100", () => {
    expect(cellRarity(data, 3, null)).toBe(100);
  });

  it("is 0 for an answer nobody else counted yet", () => {
    expect(cellRarity(data, 8, "z")).toBe(0);
  });

  it("is unavailable below the threshold", () => {
    expect(cellRarity({ finishedGames: 5, cells: null }, 0, "a")).toBeNull();
  });
});

describe("rarityScore", () => {
  it("sums the 9 cells and rounds", () => {
    const cells = ["b", null, null, null, "c", null, null, null, null];
    // 2.5 + 7.5 + 7 × 100
    expect(rarityScore(data, cells)).toBe(710);
  });

  it("is 900 for an empty board", () => {
    expect(rarityScore(data, Array(9).fill(null))).toBe(900);
  });

  it("rounds half-percentages", () => {
    const d: RarityData = { finishedGames: 3, cells: [{ cell: 0, traineeId: "a", picks: 1 }] };
    expect(rarityScore(d, ["a", null, null, null, null, null, null, null, null])).toBe(833);
  });

  it("is unavailable below the threshold", () => {
    expect(rarityScore({ finishedGames: 0, cells: null }, Array(9).fill(null))).toBeNull();
  });
});
