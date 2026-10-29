import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { guess } from "../helpers";
import { admin, openToday, pickNames, serverSession, signIn, todayPuzzle, uniqueEmail, userIdFor } from "./helpers";

test.describe("US3 – profile and data", () => {
  test("rename, opt out, export and delete the account", async ({ page }) => {
    const n = todayPuzzle();
    const email = uniqueEmail("account");
    await openToday(page);
    await signIn(page, email);
    const userId = await userIdFor(email);
    const [name] = pickNames(n, [{ cell: 0, valid: true }]);
    await guess(page, 0, name!);
    await expect.poll(async () => (await serverSession(userId, n))?.guesses.length, { timeout: 10_000 }).toBe(1);

    await page.getByRole("button", { name: "Account" }).click();
    await page.getByRole("menuitem", { name: "Account settings" }).click();
    await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
    await expect(page.getByTestId("account-email")).toHaveText(email);

    const nameInput = page.getByLabel("Display name");
    await expect(nameInput).toHaveValue(/^Trainer-\d{6}$/);
    await nameInput.fill("SiteAdmin");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("That name isn't allowed. Please choose another.")).toBeVisible();

    const newName = `Tester ${Math.floor(Math.random() * 1e6)}`;
    await nameInput.fill(newName);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();

    const leaderboard = page.getByRole("switch", { name: "Show me on leaderboards" });
    await expect(leaderboard).toBeChecked();
    await leaderboard.click();
    await expect(leaderboard).not.toBeChecked();
    const { data: profile } = await admin()
      .from("profiles")
      .select("display_name, leaderboard_opt_out")
      .eq("id", userId)
      .single();
    expect(profile).toEqual({ display_name: newName, leaderboard_opt_out: true });

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download my data" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("uma-connect-export.json");
    const exported = JSON.parse(await readFile((await file.path())!, "utf8"));
    expect(Object.keys(exported).sort()).toEqual(["exported_at", "legacy_history", "profile", "sessions"]);
    expect(exported.profile.email).toBe(email);
    expect(exported.sessions).toHaveLength(1);

    await page.getByRole("button", { name: "Delete my account" }).click();
    const confirm = page.getByRole("button", { name: "Permanently delete" });
    await expect(confirm).toBeDisabled();
    await page.getByLabel("Type DELETE to confirm").fill("DELETE");
    await confirm.click();
    await page.waitForURL((url) => url.pathname === "/");
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();

    const { data: users } = await admin().auth.admin.listUsers({ perPage: 1000 });
    expect(users.users.some((u) => u.email === email)).toBe(false);
    expect(await serverSession(userId, n)).toBeNull();
  });

  test("guests are asked to sign in", async ({ page }) => {
    await openToday(page);
    await page.goto("/account");
    await expect(page.getByText("Sign in to manage your account and data.")).toBeVisible();
  });
});
