import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { noonOfPuzzle, openDaily } from "./helpers";

test.describe("Accessibility (FR-028, FR-029)", () => {
  test("daily page has no serious axe violations", async ({ page }) => {
    await openDaily(page, noonOfPuzzle(1));
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));
    expect(serious.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });

  test("a guess can be made with the keyboard only", async ({ page, isMobile }) => {
    test.skip(isMobile, "physical-keyboard flow; touch devices don't auto-focus inputs");
    await openDaily(page, noonOfPuzzle(1));
    await page.getByRole("gridcell").first().focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("combobox")).toBeFocused();
    await page.keyboard.type("special week");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("remaining")).toHaveText("8 guesses left");
    await expect(page.getByTestId("announcement")).not.toBeEmpty();
  });

  test("fits a 360 px wide screen without horizontal scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await openDaily(page, noonOfPuzzle(1));
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
