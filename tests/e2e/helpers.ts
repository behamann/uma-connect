import { expect, type Page } from "@playwright/test";
import { dataset, schedule } from "../../src/game/data";
import { dailyGrid, dateForPuzzle } from "../../src/game/daily";
import { resolveGrid } from "../../src/game/grid";
import type { TraineeId } from "../../src/game/types";

export const LAUNCH = schedule.launchDate;

export function noonOfPuzzle(n: number): Date {
  return new Date(`${dateForPuzzle(n, LAUNCH)}T12:00:00Z`);
}

export function puzzleAnswers(n: number) {
  const grid = dailyGrid(schedule, n);
  if (!grid) throw new Error(`no puzzle #${n}`);
  return resolveGrid(grid, dataset).answers.flat();
}

const nameOf = (id: TraineeId) => {
  const t = dataset.trainees.get(id)!;
  return dataset.characters.get(t.characterId)!.name.en;
};

/** A distinct original-version answer per cell (so typing its name selects it unambiguously). */
export function validOriginalFor(n: number, cell: number, exclude: TraineeId[] = []): string {
  const id = puzzleAnswers(n)[cell]!.find(
    (id) => dataset.trainees.get(id)!.isOriginal && !exclude.includes(id),
  );
  if (!id) throw new Error(`no original answer for cell ${cell}`);
  return nameOf(id);
}

export function invalidOriginalFor(n: number, cell: number): string {
  const valid = new Set(puzzleAnswers(n)[cell]);
  const t = [...dataset.trainees.values()].find((t) => t.isOriginal && !valid.has(t.id))!;
  return nameOf(t.id);
}

export async function skipHowToPlay(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem("umagrid:v1:settings", JSON.stringify({ howToPlaySeen: true })),
  );
}

export async function openDaily(page: Page, at: Date) {
  await skipHowToPlay(page);
  await page.clock.setFixedTime(at);
  await page.goto("/");
  await expect(page.getByRole("grid")).toBeVisible();
}

export function cells(page: Page) {
  return page.getByRole("gridcell");
}

/** Opens a cell, searches a name and picks the original version. */
export async function guess(page: Page, cell: number, name: string) {
  await cells(page).nth(cell).click();
  await page.getByRole("combobox").fill(name);
  await page.getByRole("option", { name: new RegExp(`^${escape(name)}\\s+Original`) }).click();
  await expect(page.getByRole("combobox")).toBeHidden();
}

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
