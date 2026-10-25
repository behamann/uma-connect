import { expect, test } from "@playwright/test";
import { cells, guess } from "../helpers";
import {
  openToday,
  pickNames,
  serverSession,
  signIn,
  signOut,
  todayPuzzle,
  uniqueEmail,
  userIdFor,
} from "./helpers";

test.describe("US1 – sign in keeps guest progress", () => {
  test("guest game is imported on sign-in and removed from the device on sign-out", async ({ page }) => {
    const n = todayPuzzle();
    const email = uniqueEmail("import");
    const [name, wrong, later] = pickNames(n, [
      { cell: 0, valid: true },
      { cell: 4, valid: false },
      { cell: 1, valid: true },
    ]);
    await openToday(page);

    await guess(page, 0, name!);
    await guess(page, 4, wrong!);
    await expect(page.getByText("7 guesses left")).toBeVisible();

    await signIn(page, email);

    // Board unchanged after import.
    await expect(cells(page).nth(0)).toContainText(name!);
    await expect(page.getByText("7 guesses left")).toBeVisible();

    const userId = await userIdFor(email);
    await expect.poll(async () => (await serverSession(userId, n))?.guesses.length, { timeout: 10_000 }).toBe(2);
    expect((await serverSession(userId, n))?.imported).toBe(true);

    // Later guesses go straight to the account.
    await guess(page, 1, later!);
    await expect.poll(async () => (await serverSession(userId, n))?.guesses.length, { timeout: 10_000 }).toBe(3);

    await signOut(page);
    await expect(page.getByText("9 guesses left")).toBeVisible();
    const leftovers = await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => /^umagrid:v1:(daily|history|outbox|sync|auth)/.test(k)),
    );
    expect(leftovers).toEqual([]);
  });

  test("signing in again restores the account's game", async ({ page }) => {
    const n = todayPuzzle();
    const email = uniqueEmail("restore");
    await openToday(page);
    await signIn(page, email);

    const [name] = pickNames(n, [{ cell: 2, valid: true }]);
    await guess(page, 2, name!);
    const userId = await userIdFor(email);
    await expect.poll(async () => (await serverSession(userId, n))?.guesses.length, { timeout: 10_000 }).toBe(1);

    await signOut(page);
    await expect(cells(page).nth(2)).not.toContainText(name!);

    await signIn(page, email);
    await expect(cells(page).nth(2)).toContainText(name!);
    await expect(page.getByText("8 guesses left")).toBeVisible();
  });
});
