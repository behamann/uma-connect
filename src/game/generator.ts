import { cellAnswers, checkGrid, gridSignature, MIN_ANSWERS_PER_CELL, resolveGrid } from "./grid";
import { createRng, shuffle } from "./rng";
import type { CategoryId, Dataset, Grid, Triple } from "./types";

export interface GenerateOptions {
  /** Signatures (see `gridSignature`) that must not be produced. */
  exclude?: Set<string>;
  maxAttempts?: number;
}

const MAX_COLUMN_CANDIDATES = 8;

function* triples<T>(items: T[]): Generator<Triple<T>> {
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++)
      for (let k = j + 1; k < items.length; k++)
        yield [items[i] as T, items[j] as T, items[k] as T];
}

/** Deterministic for a given (dataset, seed, options); every returned grid passes `checkGrid`. */
export function generateGrid(ds: Dataset, seed: string, opts: GenerateOptions = {}): Grid | null {
  const { exclude, maxAttempts = 500 } = opts;
  const rng = createRng(seed);
  const enabled = [...ds.categories.values()].filter((c) => c.enabled).map((c) => c.id);
  if (enabled.length < 6) return null;

  const cellLooksOk = (row: CategoryId, col: CategoryId) =>
    cellAnswers(ds, row, col).length >= MIN_ANSWERS_PER_CELL;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const shuffled = shuffle(enabled, rng);
    const rows = shuffled.slice(0, 3) as Triple<CategoryId>;
    const candidates = shuffled
      .slice(3)
      .filter((col) => rows.every((row) => cellLooksOk(row, col)))
      .slice(0, MAX_COLUMN_CANDIDATES);

    for (const cols of triples(candidates)) {
      const grid: Grid = { rows, cols, kind: "practice", seed };
      if (exclude?.has(gridSignature(grid))) continue;
      if (checkGrid(resolveGrid(grid, ds), ds).ok) return grid;
    }
  }
  return null;
}
