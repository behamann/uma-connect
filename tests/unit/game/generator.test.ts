import { describe, expect, it } from "vitest";
import { loadDataset } from "@/game/dataset";
import { generateGrid } from "@/game/generator";
import { checkGrid, gridSignature, resolveGrid } from "@/game/grid";
import { fixtureRaw } from "../../fixtures/dataset";

const ds = loadDataset(fixtureRaw());

describe("generateGrid", () => {
  it("is deterministic for the same seed", () => {
    expect(generateGrid(ds, "abc")).toEqual(generateGrid(ds, "abc"));
  });

  it("only returns grids that pass checkGrid", () => {
    let generated = 0;
    const signatures = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const g = generateGrid(ds, `seed-${i}`);
      if (!g) continue;
      generated++;
      signatures.add(gridSignature(g));
      expect(checkGrid(resolveGrid(g, ds), ds).ok).toBe(true);
    }
    expect(generated).toBeGreaterThan(50);
    expect(signatures.size).toBeGreaterThan(10);
  });

  it("never returns an excluded signature", () => {
    const first = generateGrid(ds, "x")!;
    const second = generateGrid(ds, "x", { exclude: new Set([gridSignature(first)]) });
    if (second) expect(gridSignature(second)).not.toBe(gridSignature(first));
  });

  it("returns null when no grid can be found", () => {
    expect(generateGrid(ds, "x", { maxAttempts: 0 })).toBeNull();
  });
});
