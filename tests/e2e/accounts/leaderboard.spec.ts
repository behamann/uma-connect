import { expect, test, type Page } from "@playwright/test";
import { puzzleAnswers } from "../helpers";
import { admin, openToday, signIn, todayPuzzle, uniqueEmail, userIdFor } from "./helpers";

const tag = () => String(Math.floor(Math.random() * 1e6)).padStart(6, "0");

/** Inserts a finished game for today with `score` correct cells (imported: never counts for rarity). */
async function finishedGame(userId: string, score: number, finishedAt: string) {
  const n = todayPuzzle();
  const answers = puzzleAnswers(n);
  const guesses = Array.from({ length: score }, (_, cell) => ({
    cell,
    trainee_id: answers[cell]![0],
    correct: true,
    at: finishedAt,
  }));
  const { error } = await admin()
    .from("daily_sessions")
    .upsert({
      user_id: userId,
      puzzle_number: n,
      guesses,
      score,
      status: score === 9 ? "completed" : "gave_up",
      imported: true,
      finished_at: finishedAt,
    });
  if (error) throw error;
}

async function seedPlayer(name: string, score: number, optOut = false) {
  const { data, error } = await admin().auth.admin.createUser({ email: uniqueEmail("lb"), email_confirm: true });
  if (error) throw error;
  const { error: profileError } = await admin()
    .from("profiles")
    .update({ display_name: name, leaderboard_opt_out: optOut })
    .eq("id", data.user.id);
  if (profileError) throw profileError;
  await finishedGame(data.user.id, score, new Date(Date.now() - 3_600_000).toISOString());
}

async function rowNames(page: Page) {
  return (await page.getByTestId("leaderboard-row").getByRole("rowheader").allTextContents()).map((t) =>
    t.replace(/\(you\)$/, "").trim(),
  );
}

test.describe("US5 – leaderboards", () => {
  test("ranks players, highlights my row and hides opted-out players", async ({ page }) => {
    const id = tag();
    const [top, mid, hidden, mine] = [`LbTop-${id}`, `LbMid-${id}`, `LbHidden-${id}`, `LbMe-${id}`];
    await seedPlayer(top, 9);
    await seedPlayer(mid, 7);
    await seedPlayer(hidden, 8, true);

    const email = uniqueEmail("leaderboard");
    await openToday(page);
    await signIn(page, email);
    const userId = await userIdFor(email);
    const { error: nameError } = await admin().from("profiles").update({ display_name: mine }).eq("id", userId);
    if (nameError) throw nameError;
    await finishedGame(userId, 6, new Date().toISOString());
    const { error: refreshError } = await admin().rpc("refresh_leaderboards");
    if (refreshError) throw refreshError;

    await page.getByRole("link", { name: "Leaderboards" }).click();
    await expect(page.getByRole("heading", { name: "Leaderboards" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Daily" })).toHaveAttribute("aria-selected", "true");

    const checkBoard = async () => {
      const own = page.locator('[data-testid="leaderboard-row"][aria-current="true"]');
      await expect(own).toHaveCount(1);
      await expect(own.getByRole("rowheader")).toContainText(mine);
      const names = (await rowNames(page)).filter((n) => n.endsWith(id));
      expect(names).toEqual([top, mid, mine]);
    };

    await checkBoard();
    await expect(page.getByTestId("leaderboard-updated")).toHaveCount(0);

    await page.getByRole("tab", { name: "Weekly" }).click();
    await checkBoard();
    await expect(page.getByTestId("leaderboard-updated")).toContainText("Updated");

    await page.getByRole("tab", { name: "All-time" }).click();
    await expect(page.getByRole("rowheader", { name: top })).toBeVisible();
    expect(await rowNames(page)).not.toContain(hidden);
  });

  test("guests can view the leaderboard without an own rank", async ({ page }) => {
    await openToday(page);
    await page.getByRole("link", { name: "Leaderboards" }).click();
    await expect(page.getByText("Sign in to appear on the leaderboards.")).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.locator('[aria-current="true"][data-testid="leaderboard-row"]')).toHaveCount(0);
  });
});
