import { expect, test, type Browser } from "@playwright/test";
import { cells, guess } from "../helpers";
import { openToday, pickNames, serverSession, signIn, todayPuzzle, uniqueEmail, userIdFor } from "./helpers";

async function device(browser: Browser) {
  const context = await browser.newContext();
  return { context, page: await context.newPage() };
}

test.describe("US2 – continue on another device", () => {
  test("the same game appears on a second device, including when finished", async ({ browser }) => {
    const n = todayPuzzle();
    const email = uniqueEmail("devices");
    const names = pickNames(n, [
      { cell: 0, valid: true },
      { cell: 3, valid: false },
      { cell: 8, valid: true },
    ]);

    const a = await device(browser);
    await openToday(a.page);
    await signIn(a.page, email);
    for (const [i, name] of names.entries()) await guess(a.page, [0, 3, 8][i]!, name);
    await expect(a.page.getByText("6 guesses left")).toBeVisible();

    const b = await device(browser);
    await openToday(b.page);
    await signIn(b.page, email);
    await expect(cells(b.page).nth(0)).toContainText(names[0]!);
    await expect(cells(b.page).nth(8)).toContainText(names[2]!);
    await expect(b.page.getByText("6 guesses left")).toBeVisible();

    await a.page.getByRole("button", { name: "Give up" }).click();
    await a.page.getByRole("button", { name: "Confirm give up" }).click();
    await expect(a.page.getByRole("dialog")).toBeVisible();

    await expect
      .poll(async () => (await serverSession(await userIdFor(email), n))?.status, { timeout: 10_000 })
      .toBe("gave_up");
    await b.page.reload();
    await expect(b.page.getByRole("button", { name: "Results" })).toBeVisible({ timeout: 10_000 });
    await expect(b.page.getByRole("button", { name: "Give up" })).toBeHidden();

    await a.context.close();
    await b.context.close();
  });
});
