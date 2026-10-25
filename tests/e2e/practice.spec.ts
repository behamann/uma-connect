import { expect, test } from "@playwright/test";
import { cells, skipHowToPlay } from "./helpers";

const headers = (page: import("@playwright/test").Page) =>
  page.locator('[role="columnheader"] button, [role="rowheader"] button').allInnerTexts();

test.describe("US6 – practice mode", () => {
  test.beforeEach(async ({ page }) => skipHowToPlay(page));

  test("the same seed gives the same grid; New grid changes it", async ({ page }) => {
    await page.goto("/practice?seed=abc");
    await expect(page.getByRole("grid")).toBeVisible();
    const first = await headers(page);
    expect(first).toHaveLength(6);

    await page.goto("/practice?seed=abc");
    await expect(page.getByRole("grid")).toBeVisible();
    expect(await headers(page)).toEqual(first);

    await page.getByRole("button", { name: "New grid" }).click();
    await expect(page).not.toHaveURL(/seed=abc/);
    await expect(page.getByRole("grid")).toBeVisible();
  });

  test("a missing seed gets one in the URL", async ({ page }) => {
    await page.goto("/practice");
    await expect(page).toHaveURL(/\/practice\?seed=\w+/);
  });

  test("practice never touches daily progress or history", async ({ page }) => {
    await page.goto("/practice?seed=abc");
    await cells(page).nth(0).click();
    await page.getByRole("combobox").fill("special week");
    await page.getByRole("option").first().click();
    await page.getByRole("button", { name: "Give up" }).click();
    await page.getByRole("button", { name: "Confirm give up" }).click();
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Results" })).toBeVisible();

    const keys = await page.evaluate(() => Object.keys(localStorage));
    expect(keys.filter((k) => k.startsWith("umagrid:v1:daily") || k === "umagrid:v1:history")).toEqual([]);
  });
});
