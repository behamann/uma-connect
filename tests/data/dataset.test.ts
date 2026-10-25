import { describe, expect, it } from "vitest";
import charactersRaw from "../../data/characters.json" with { type: "json" };
import categoriesRaw from "../../data/categories.json" with { type: "json" };
import scheduleRaw from "../../data/schedule.json" with { type: "json" };
import traineesRaw from "../../data/trainees.json" with { type: "json" };
import { dataset, schedule } from "@/game/data";
import { dailyGrid } from "@/game/daily";
import { loadDataset, loadSchedule } from "@/game/dataset";
import { categoryMembers, checkGrid, resolveGrid } from "@/game/grid";

describe("real dataset", () => {
  it("passes schema validation (the app bundle skips it)", () => {
    expect(() =>
      loadDataset({ characters: charactersRaw, trainees: traineesRaw, categories: categoriesRaw }),
    ).not.toThrow();
    expect(() => loadSchedule(scheduleRaw)).not.toThrow();
  });

  it("every enabled category matches at least 3 trainee versions", () => {
    for (const cat of dataset.categories.values()) {
      if (cat.enabled) expect(categoryMembers(dataset, cat.id).size, cat.id).toBeGreaterThanOrEqual(3);
    }
  });

  it("every scheduled daily grid passes checkGrid", () => {
    expect(schedule.puzzles.length).toBeGreaterThan(0);
    for (const entry of schedule.puzzles) {
      const grid = dailyGrid(schedule, entry.puzzleNumber)!;
      const check = checkGrid(resolveGrid(grid, dataset), dataset);
      expect(check.problems, `puzzle #${entry.puzzleNumber}`).toEqual([]);
    }
  });
});
