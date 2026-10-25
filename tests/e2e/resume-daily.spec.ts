import { expect, test } from "@playwright/test";
import { cells, guess, invalidOriginalFor, noonOfPuzzle, openDaily, validOriginalFor } from "./helpers";

test.describe("US2 – resume and finish the daily game", () => {
  test("progress is restored after reload", async ({ page }) => {
    await openDaily(page, noonOfPuzzle(1));
    const a = validOriginalFor(1, 0);
    await guess(page, 0, a);
    await guess(page, 4, invalidOriginalFor(1, 4));
    await guess(page, 8, invalidOriginalFor(1, 8));

    await page.reload();
    await expect(page.getByTestId("remaining")).toHaveText("6 guesses left");
    await expect(page.locator('[data-filled="true"]')).toHaveCount(1);
    await expect(cells(page).nth(0)).toContainText(a);
  });

  test("a finished game stays finished for the day", async ({ page }) => {
    await openDaily(page, noonOfPuzzle(1));
    await page.getByRole("button", { name: "Give up" }).click();
    await page.getByRole("button", { name: "Confirm give up" }).click();
    await page.reload();
    await expect(page.getByTestId("final-score")).toBeVisible();
    await expect(page.getByTestId("countdown")).toBeVisible();
    await expect(page.getByRole("button", { name: "Give up" })).toHaveCount(0);
    await expect(cells(page).nth(0)).toHaveAttribute("aria-disabled", "true");
  });

  test("a new grid appears after 00:00 UTC", async ({ page }) => {
    await openDaily(page, new Date(`${noonOfPuzzle(1).toISOString().slice(0, 10)}T23:59:00Z`));
    await guess(page, 0, invalidOriginalFor(1, 0));
    await expect(page.getByTestId("remaining")).toHaveText("8 guesses left");

    await page.clock.setFixedTime(new Date(noonOfPuzzle(2).getTime() - 12 * 3600_000 + 60_000));
    await page.reload();
    await expect(page.getByRole("heading", { name: "Umagrid #2" })).toBeVisible();
    await expect(page.getByTestId("remaining")).toHaveText("9 guesses left");
  });
});
