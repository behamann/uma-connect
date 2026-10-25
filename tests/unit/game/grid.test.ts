import { describe, expect, it } from "vitest";
import { loadDataset } from "@/game/dataset";
import { checkGrid, gridSignature, resolveGrid } from "@/game/grid";
import type { Grid } from "@/game/types";
import { char, categoriesRaw, fixtureRaw, trainee } from "../../fixtures/dataset";

const ds = loadDataset(fixtureRaw());

function grid(rows: string[], cols: string[]): Grid {
  return { rows: rows as Grid["rows"], cols: cols as Grid["cols"], kind: "practice" };
}

function problemsOf(g: Grid, dataset = ds) {
  return checkGrid(resolveGrid(g, dataset), dataset).problems.join("\n");
}

describe("resolveGrid", () => {
  it("returns trainees matching both row and column", () => {
    const r = resolveGrid(grid(["dorm-ritto", "pace-a", "turf-a"], ["dirt-a", "sire-ss", "medium-a"]), ds);
    expect(r.answers[0]![0]!.sort()).toEqual(["t1s", "t3", "t6"]);
  });
});

describe("checkGrid", () => {
  it("accepts a valid grid", () => {
    const g = grid(["medium-a", "pace-a", "turf-a"], ["sire-ss", "sire-mp", "dorm-ritto"]);
    expect(checkGrid(resolveGrid(g, ds), ds)).toEqual({ ok: true, problems: [] });
  });

  it("rejects cells with fewer than 3 answers", () => {
    const g = grid(["season-winter", "pace-a", "turf-a"], ["dorm-miho", "sire-ss", "medium-a"]);
    expect(problemsOf(g)).toContain("season-winter × dorm-miho: 1 answers");
  });

  it("rejects cells whose answers all belong to one character", () => {
    const raw = fixtureRaw();
    raw.trainees.trainees.push(trainee("t1b", "c1", { isOriginal: false }));
    raw.trainees.trainees.push(trainee("t1c", "c1", { isOriginal: false }));
    const local = loadDataset(raw);
    const g = grid(["season-winter", "pace-a", "turf-a"], ["coat-bay", "medium-a", "sire-mp"]);
    expect(problemsOf(g, local)).toContain("season-winter × coat-bay: 1 characters");
  });

  it("rejects grids with fewer than 4 category groups", () => {
    const g = grid(["medium-a", "long-a", "mile-a"], ["pace-a", "front-a", "turf-a"]);
    expect(problemsOf(g)).toContain("3 groups");
  });

  it("rejects disabled, unknown, and repeated categories", () => {
    const p = problemsOf(grid(["disabled-cat", "nope", "turf-a"], ["turf-a", "sire-ss", "medium-a"]));
    expect(p).toContain('category "disabled-cat" is disabled');
    expect(p).toContain('unknown category "nope"');
    expect(p).toContain("6 distinct");
  });

  it("rejects grids only solvable by reusing a character via two versions", () => {
    const characters = [1, 2, 3, 4, 5].map((i) => char(i));
    const trainees = characters.flatMap((c) => [
      trainee(`${c.id}-a`, c.id as string, { mile: "A" }),
      trainee(`${c.id}-b`, c.id as string, { mile: "A", isOriginal: false }),
    ]);
    const local = loadDataset({
      characters: { characters },
      trainees: { trainees },
      categories: categoriesRaw(),
    });
    const g = grid(["turf-a", "medium-a", "pace-a"], ["dorm-ritto", "decade-1990s", "mile-a"]);
    const result = checkGrid(resolveGrid(g, local), local);
    expect(result.ok).toBe(false);
    expect(result.problems).toEqual(["grid cannot be solved with 9 different characters"]);
  });
});

describe("gridSignature", () => {
  it("is independent of row/column order", () => {
    expect(gridSignature(grid(["a", "b", "c"], ["d", "e", "f"]))).toBe(
      gridSignature(grid(["f", "e", "d"], ["c", "b", "a"])),
    );
  });
});
