import { expect, test } from "@playwright/test";
import {
  cells,
  guess,
  invalidOriginalFor,
  noonOfPuzzle,
  openDaily,
  skipHowToPlay,
  validOriginalFor,
} from "./helpers";

const DAY = noonOfPuzzle(1);

test.describe("US1 – play today's grid", () => {
  test("shows 6 categories, 9 empty cells, and 9 guesses", async ({ page }) => {
    await openDaily(page, DAY);
    await expect(page.getByRole("heading", { name: "Umagrid #1" })).toBeVisible();
    await expect(page.getByRole("columnheader").filter({ hasText: /\S/ })).toHaveCount(3);
    await expect(page.getByRole("rowheader")).toHaveCount(3);
    await expect(cells(page)).toHaveCount(9);
    await expect(page.locator('[data-filled="true"]')).toHaveCount(0);
    await expect(page.getByTestId("remaining")).toHaveText("9 guesses left");
  });

  test("a valid guess locks the cell; an invalid one only consumes a guess", async ({ page }) => {
    await openDaily(page, DAY);
    const valid = validOriginalFor(1, 0);
    await guess(page, 0, valid);
    await expect(cells(page).nth(0)).toHaveAttribute("data-filled", "true");
    await expect(cells(page).nth(0)).toContainText(valid);
    await expect(page.getByTestId("announcement")).toContainText("Correct!");
    await expect(page.getByTestId("remaining")).toHaveText("8 guesses left");

    await guess(page, 1, invalidOriginalFor(1, 1));
    await expect(cells(page).nth(1)).toHaveAttribute("data-filled", "false");
    await expect(page.getByTestId("announcement")).toContainText("Wrong:");
    await expect(page.getByTestId("remaining")).toHaveText("7 guesses left");
  });

  test("a used trainee is unavailable and does not consume a guess", async ({ page }) => {
    await openDaily(page, DAY);
    const valid = validOriginalFor(1, 0);
    await guess(page, 0, valid);
    await cells(page).nth(4).click();
    await page.getByRole("combobox").fill(valid);
    const option = page.getByRole("option", { name: new RegExp(`^${valid}`) }).first();
    await expect(option).toContainText("Already used");
    await expect(option).toHaveAttribute("aria-disabled", "true");
    await option.click({ force: true });
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("remaining")).toHaveText("8 guesses left");
  });

  test("give up ends the game", async ({ page }) => {
    await openDaily(page, DAY);
    await page.getByRole("button", { name: "Give up" }).click();
    await page.getByRole("button", { name: "Confirm give up" }).click();
    await expect(page.getByTestId("final-score")).toHaveText("Final score: 0/9");
  });

  test("the game ends after 9 guesses", async ({ page }) => {
    await openDaily(page, DAY);
    const wrong = invalidOriginalFor(1, 0);
    for (let i = 0; i < 9; i++) await guess(page, 0, wrong);
    await expect(page.getByTestId("final-score")).toHaveText("Final score: 0/9");
    await expect(page.getByTestId("remaining")).toHaveCount(0);
  });

  test("a date without a scheduled grid shows a friendly error", async ({ page }) => {
    await skipHowToPlay(page);
    await page.clock.setFixedTime(new Date("2099-01-01T12:00:00Z"));
    await page.goto("/");
    await expect(page.getByRole("alert").filter({ hasText: "isn't available" })).toBeVisible();
  });
});
