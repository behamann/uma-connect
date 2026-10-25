import { expect, test } from "@playwright/test";
import { dataset, schedule } from "../../src/game/data";
import { noonOfPuzzle } from "./helpers";

test.describe("US4 – rules and categories", () => {
  test("How to play is shown on the first visit only and can be reopened", async ({ page }) => {
    await page.clock.setFixedTime(noonOfPuzzle(1));
    await page.goto("/");
    const dialog = page.getByRole("dialog", { name: "How to play" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Let's play!" }).click();
    await expect(dialog).toBeHidden();

    await page.reload();
    await expect(page.getByRole("grid")).toBeVisible();
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: "How to play" }).click();
    await expect(dialog).toBeVisible();
  });

  test("each category header reveals its rule (click and keyboard)", async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem("umagrid:v1:settings", JSON.stringify({ howToPlaySeen: true })),
    );
    await page.clock.setFixedTime(noonOfPuzzle(1));
    await page.goto("/");
    const entry = schedule.puzzles[0]!;
    const col = dataset.categories.get(entry.cols[0])!;
    const row = dataset.categories.get(entry.rows[0])!;

    await page.getByRole("button", { name: col.label.en, exact: true }).click();
    await expect(page.getByText(col.rule.en)).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: row.label.en, exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText(row.rule.en)).toBeVisible();
  });
});
