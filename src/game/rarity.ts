/** Rarity of answers (FR-021): share of eligible finished games that picked the same answer. */

export interface RarityData {
  finishedGames: number;
  cells: { cell: number; traineeId: string; picks: number }[] | null;
}

/** Percentage 0–100 for one cell; empty/wrong cells count 100; null when not available yet. */
export function cellRarity(data: RarityData, cell: number, traineeId: string | null): number | null {
  if (!data.cells || data.finishedGames <= 0) return null;
  if (traineeId === null) return 100;
  const picks = data.cells.find((c) => c.cell === cell && c.traineeId === traineeId)?.picks ?? 0;
  return Math.min(100, (picks / data.finishedGames) * 100);
}

/** Sum of the 9 cell percentages, rounded; lower is rarer. */
export function rarityScore(data: RarityData, cells: (string | null)[]): number | null {
  if (!data.cells || data.finishedGames <= 0) return null;
  let total = 0;
  for (let cell = 0; cell < 9; cell++) total += cellRarity(data, cell, cells[cell] ?? null)!;
  return Math.round(total);
}
