import { expect, test, type Browser } from "@playwright/test";
import { cells, guess } from "../helpers";
import { openToday, pickNames, serverSession, signIn, todayPuzzle, uniqueEmail, userIdFor } from "./helpers";

async function device(browser: Browser) {
  const context = await browser.newContext();
  return { context, page: await context.newPage() };
}

test.describe("US2 – first device wins", () => {
  test("an offline device adopts the game that reached the account first", async ({ browser }) => {
    const n = todayPuzzle();
    const email = uniqueEmail("conflict");
    const [first, second] = pickNames(n, [
      { cell: 0, valid: true },
      { cell: 4, valid: true },
    ]);

    const a = await device(browser);
    await openToday(a.page);
    await signIn(a.page, email);
    const b = await device(browser);
    await openToday(b.page);
    await signIn(b.page, email);

    await b.context.setOffline(true);
    await guess(b.page, 4, second!);
    await expect(cells(b.page).nth(4)).toContainText(second!);

    await guess(a.page, 0, first!);
    const userId = await userIdFor(email);
    await expect.poll(async () => (await serverSession(userId, n))?.guesses.length, { timeout: 10_000 }).toBe(1);

    await b.context.setOffline(false);
    await expect(b.page.getByRole("status").filter({ hasText: "another device" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(cells(b.page).nth(0)).toContainText(first!);
    await expect(cells(b.page).nth(4)).not.toContainText(second!);
    expect((await serverSession(userId, n))?.guesses).toHaveLength(1);

    await b.page.getByRole("button", { name: "Dismiss" }).click();
    await expect(b.page.getByText("another device")).toBeHidden();

    await a.context.close();
    await b.context.close();
  });
});
