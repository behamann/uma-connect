import { expect, test } from "@playwright/test";
import { noonOfPuzzle, openDaily } from "./helpers";

async function giveUp(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Give up" }).click();
  await page.getByRole("button", { name: "Confirm give up" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
}

test.describe("US5 – personal statistics", () => {
  test("three consecutive days give a streak of 3", async ({ page }) => {
    for (const n of [1, 2, 3]) {
      await openDaily(page, noonOfPuzzle(n));
      await giveUp(page);
    }
    await page.getByRole("button", { name: "Stats" }).click();
    await expect(page.getByTestId("stat-played")).toHaveText("3");
    await expect(page.getByTestId("stat-currentStreak")).toHaveText("3");
    await expect(page.getByTestId("stat-bestStreak")).toHaveText("3");
    await expect(page.getByTestId("stat-perfect")).toHaveText("0");
  });

  test("a missed day resets the current streak but keeps the best", async ({ page }) => {
    for (const n of [1, 2, 4]) {
      await openDaily(page, noonOfPuzzle(n));
      await giveUp(page);
    }
    await page.getByRole("button", { name: "Stats" }).click();
    await expect(page.getByTestId("stat-currentStreak")).toHaveText("1");
    await expect(page.getByTestId("stat-bestStreak")).toHaveText("2");
  });
});
