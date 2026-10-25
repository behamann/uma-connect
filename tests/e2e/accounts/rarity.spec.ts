import { expect, test, type Page } from "@playwright/test";
import { dataset } from "../../../src/game/data";
import { guess, puzzleAnswers } from "../helpers";
import { admin, openToday, todayPuzzle } from "./helpers";

// These tests rewrite today's shared rarity counters, so they must not run concurrently.
test.describe.configure({ mode: "serial" });

async function finishAsGuest(page: Page, name: string) {
  await guess(page, 0, name);
  await page.getByRole("button", { name: "Give up" }).click();
  await page.getByRole("button", { name: "Confirm give up" }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Results" })).toBeVisible();
}

async function setStats(puzzle: number, finishedGames: number, cell: number, traineeId: string, picks: number) {
  const db = admin();
  await db.from("puzzle_stats").upsert({ puzzle_number: puzzle, finished_games: finishedGames });
  await db.from("answer_counts").upsert({ puzzle_number: puzzle, cell, trainee_id: traineeId, picks });
}

test.describe("US4 – rarity", () => {
  const n = todayPuzzle();
  const id = puzzleAnswers(n)[0]!.find((t) => dataset.trainees.get(t)!.isOriginal)!;
  const name = dataset.characters.get(dataset.trainees.get(id)!.characterId)!.name.en;

  test("shows per-cell percentages and the total once enough players finished", async ({ page }) => {
    await setStats(n, 999, 0, id, 249);
    await openToday(page);
    await finishAsGuest(page, name);

    // This guest's game is counted too: 250 / 1000 = 25%, other 8 cells count 100 each.
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByTestId("cell-rarity").first()).toHaveText(/^Rarity: 25(\.\d)?%$/);
    await expect(dialog.getByTestId("cell-rarity").nth(1)).toHaveText("Rarity: 100%");
    await expect(dialog.getByTestId("results-rarity")).toHaveText(/^Rarity score: 82\d \(lower is rarer\)$/);

    await page.evaluate(() =>
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: async (t: string) => void ((window as unknown as { __copied: string }).__copied = t) },
      }),
    );
    await dialog.getByRole("button", { name: "Share" }).click();
    const text = await page.evaluate(() => (window as unknown as { __copied: string }).__copied);
    expect(text.split("\n")[1]).toMatch(/^Rarity: 82\d$/);
    expect(text).not.toContain(name);
  });

  test("says when there are not enough players yet", async ({ page }) => {
    await setStats(n, 4, 0, id, 1);
    await openToday(page);
    await finishAsGuest(page, name);
    // 4 seeded + this guest (other test files may finish today's grid concurrently).
    await expect(page.getByTestId("results-rarity")).toHaveText(/^Rarity: not enough players yet \(([5-9]|1\d)\/20\)$/);
    await expect(page.getByTestId("cell-rarity").first()).toHaveText("Rarity: —");
  });

  test("marks rarity unavailable when the backend can't be reached", async ({ page }) => {
    await page.route("**/rest/v1/rpc/get_rarity", (route) => route.abort());
    await openToday(page);
    await finishAsGuest(page, name);
    await expect(page.getByTestId("results-rarity")).toHaveText("Rarity is unavailable right now.");
    await expect(page.getByTestId("results-score")).toHaveText("You filled 1/9 cells");
  });
});
