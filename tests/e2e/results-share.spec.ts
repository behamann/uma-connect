import { expect, test } from "@playwright/test";
import { guess, noonOfPuzzle, openDaily, puzzleAnswers, validOriginalFor } from "./helpers";

test.describe("US3 – review results and share", () => {
  test("results list every cell's valid answers and share copies a spoiler-free summary", async ({
    page,
  }) => {
    // The system clipboard is shared between parallel workers; capture writes per page instead.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: async (text: string) => {
            (window as unknown as { __copied: string }).__copied = text;
          },
        },
      });
    });
    await openDaily(page, noonOfPuzzle(1));
    const name = validOriginalFor(1, 0);
    await guess(page, 0, name);
    await page.getByRole("button", { name: "Give up" }).click();
    await page.getByRole("button", { name: "Confirm give up" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Results" })).toBeVisible();
    await expect(dialog.getByTestId("results-score")).toHaveText("You filled 1/9 cells");
    const cellsList = dialog.getByTestId("results-cells").locator(":scope > li");
    await expect(cellsList).toHaveCount(9);
    const answers = puzzleAnswers(1);
    await expect(cellsList.nth(0)).toContainText(`${answers[0]!.length} valid answer`);
    // "—" until enough players finished (or without a backend), then a percentage.
    await expect(cellsList.nth(0)).toContainText(/Rarity: (—|[\d.]+%)/);

    await dialog.getByRole("button", { name: "Share" }).click();
    await expect(dialog.getByText("Copied to clipboard!")).toBeVisible();
    const text = await page.evaluate(() => (window as unknown as { __copied: string }).__copied);
    const lines = text.split("\n");
    expect(lines[0]).toBe("Umagrid #1 1/9");
    expect(lines.slice(1, 4)).toEqual(["🟩⬜⬜", "⬜⬜⬜", "⬜⬜⬜"]);
    expect(text).not.toContain(name);
  });

  test("results can be reopened after closing", async ({ page }) => {
    await openDaily(page, noonOfPuzzle(1));
    await page.getByRole("button", { name: "Give up" }).click();
    await page.getByRole("button", { name: "Confirm give up" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await page.getByRole("button", { name: "Results" }).click();
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Results" })).toBeVisible();
  });
});
