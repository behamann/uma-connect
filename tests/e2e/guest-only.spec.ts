import { expect, test } from "@playwright/test";
import { guess, noonOfPuzzle, openDaily, validOriginalFor } from "./helpers";

const isExternal = (url: string, origin: string) => /^https?:/.test(url) && new URL(url).origin !== origin;

test.describe("Guest-only guarantee (A1, SC-004)", () => {
  test("loading and playing as a guest makes no backend requests", async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin;
    const external: string[] = [];
    page.on("request", (r) => {
      if (isExternal(r.url(), origin)) external.push(r.url());
    });

    await openDaily(page, noonOfPuzzle(1));
    await guess(page, 0, validOriginalFor(1, 0));
    await page.reload();
    await expect(page.getByRole("grid")).toBeVisible();
    await page.goto("/practice?seed=abc");
    await expect(page.getByRole("grid")).toBeVisible();
    await page.goto("/about");
    await page.waitForLoadState("networkidle");

    expect(external).toEqual([]);
  });

  test("daily, results and practice work with the backend unreachable", async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin;
    await page.route(
      (url) => isExternal(url.href, origin),
      (route) => route.abort(),
    );

    await openDaily(page, noonOfPuzzle(1));
    await guess(page, 0, validOriginalFor(1, 0));
    await page.getByRole("button", { name: "Give up" }).click();
    await page.getByRole("button", { name: "Confirm give up" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByTestId("results-score")).toHaveText("You filled 1/9 cells");
    await expect(dialog.getByText("Rarity is unavailable right now.")).toBeVisible();

    await page.goto("/practice?seed=abc");
    await expect(page.getByRole("grid")).toBeVisible();
    await expect(page.getByRole("button", { name: "New grid" })).toBeEnabled();
  });
});
