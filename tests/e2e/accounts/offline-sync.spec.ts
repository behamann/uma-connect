import { expect, test } from "@playwright/test";
import { guess } from "../helpers";
import { openToday, pickNames, serverSession, signIn, todayPuzzle, uniqueEmail, userIdFor } from "./helpers";

test.describe("US1 – offline play while signed in", () => {
  test("guesses made offline reach the account when the connection returns", async ({ page, context }) => {
    const n = todayPuzzle();
    const email = uniqueEmail("offline");
    const names = pickNames(n, [
      { cell: 0, valid: true },
      { cell: 1, valid: false },
      { cell: 2, valid: true },
    ]);
    await openToday(page);
    await signIn(page, email);
    const userId = await userIdFor(email);

    await context.setOffline(true);
    for (const [i, name] of names.entries()) await guess(page, i, name);
    await expect(page.getByText("6 guesses left")).toBeVisible();
    expect(await serverSession(userId, n)).toBeNull();

    await context.setOffline(false);
    await expect.poll(async () => (await serverSession(userId, n))?.guesses.length, { timeout: 5_000 }).toBe(3);
  });

  test("practice games are never sent to the account", async ({ page }) => {
    await openToday(page);
    await signIn(page, uniqueEmail("practice"));

    const rpcCalls: string[] = [];
    page.on("request", (req) => {
      if (/\/rest\/v1\/rpc\/(record_guess|give_up|import_local)/.test(req.url())) rpcCalls.push(req.url());
    });
    await page.getByRole("link", { name: "Practice" }).click();
    await expect(page.getByRole("grid")).toBeVisible();
    await page.getByRole("button", { name: "Give up" }).click();
    await page.getByRole("button", { name: "Confirm give up" }).click();
    await page.waitForTimeout(1500);
    expect(rpcCalls).toEqual([]);
  });
});
