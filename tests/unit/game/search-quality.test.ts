import { describe, expect, it } from "vitest";
import { dataset } from "@/game/data";
import { buildSearchIndex, search } from "@/game/search";

const index = buildSearchIndex(dataset, "en");

function queriesFor(name: string): string[] {
  const words = name.split(/\s+/);
  return [
    name.toLowerCase(),
    name.toUpperCase().replace(/ /g, "-"),
    words.map((w) => w.slice(0, 4)).join(" "),
    name.replace(/\s+/g, ""),
  ].filter((q) => q.replace(/\W/g, "").length >= 3);
}

describe("search quality on the real roster (SC-004)", () => {
  const originals = [...dataset.trainees.values()].filter((t) => t.isOriginal);
  const cases = originals.flatMap((t) =>
    queriesFor(dataset.characters.get(t.characterId)!.name.en).map((q) => ({ q, id: t.id })),
  );

  it("finds the intended trainee in the top 5 for ≥ 95% of queries", () => {
    const misses = cases.filter(({ q, id }) => !search(index, q, 5).includes(id));
    const rate = 1 - misses.length / cases.length;
    expect(rate, `misses: ${misses.slice(0, 10).map((m) => m.q).join(", ")}`).toBeGreaterThanOrEqual(0.95);
  });

  it("answers each query in under 50 ms", () => {
    for (const { q } of cases) {
      const start = performance.now();
      search(index, q);
      expect(performance.now() - start, q).toBeLessThan(50);
    }
  });
});
