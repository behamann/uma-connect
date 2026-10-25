import { describe, expect, it } from "vitest";
import { gradeAtLeast, matches } from "@/game/categories";
import { loadDataset } from "@/game/dataset";
import { fixtureRaw } from "../../fixtures/dataset";

const ds = loadDataset(fixtureRaw());
const cat = (id: string) => ds.categories.get(id)!;
const t = (id: string) => ds.trainees.get(id)!;
const check = (catId: string, traineeId: string) => {
  const tr = t(traineeId);
  return matches(cat(catId), tr, ds.characters.get(tr.characterId)!);
};

describe("gradeAtLeast", () => {
  it("treats S as above A and B as below A", () => {
    expect(gradeAtLeast("S", "A")).toBe(true);
    expect(gradeAtLeast("A", "A")).toBe(true);
    expect(gradeAtLeast("B", "A")).toBe(false);
    expect(gradeAtLeast("G", "A")).toBe(false);
  });
});

describe("matches", () => {
  it("aptitude uses the trainee version's own grades", () => {
    expect(check("dirt-a", "t1")).toBe(false);
    expect(check("dirt-a", "t1s")).toBe(true);
    expect(check("long-a", "t7")).toBe(true); // S passes ≥ A
    expect(check("long-a", "t1")).toBe(false); // B fails
  });

  it("equals checks dorm and coat", () => {
    expect(check("dorm-ritto", "t1")).toBe(true);
    expect(check("dorm-miho", "t1")).toBe(false);
    expect(check("coat-bay", "t1")).toBe(true);
    expect(check("coat-bay", "t2")).toBe(false);
  });

  it("birthMonth matches any listed month", () => {
    expect(check("season-winter", "t1")).toBe(true);
    expect(check("season-winter", "t12")).toBe(true);
    expect(check("season-spring", "t1")).toBe(false);
  });

  it("includes matches any of the values", () => {
    expect(check("g1-arima-or-jc", "t1")).toBe(true);
    expect(check("g1-arima-or-jc", "t5")).toBe(true);
    expect(check("g1-arima-or-jc", "t9")).toBe(false);
    expect(check("sire-ss", "t1")).toBe(true);
    expect(check("sire-ss", "t2")).toBe(false);
  });

  it("character attributes are shared across versions", () => {
    expect(check("sire-ss", "t1s")).toBe(true);
    expect(check("dorm-ritto", "t1s")).toBe(true);
  });

  it("atLeast and range compare numbers inclusively", () => {
    expect(check("g1-count-3", "t3")).toBe(true);
    expect(check("g1-count-3", "t2")).toBe(false);
    expect(check("decade-1990s", "t9")).toBe(true); // 1999
    expect(check("decade-1990s", "t10")).toBe(false); // 2000
  });
});
