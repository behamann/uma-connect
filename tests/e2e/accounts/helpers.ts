import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";
import { localStack, type StackEnv } from "../../../scripts/backend/local-stack";
import { dataset, schedule } from "../../../src/game/data";
import { puzzleNumberFor } from "../../../src/game/daily";
import { puzzleAnswers, skipHowToPlay } from "../helpers";

const MAILPIT = "http://127.0.0.1:54324";

let stack: StackEnv | null | undefined;
function env(): StackEnv {
  stack ??= localStack();
  if (!stack) throw new Error("Local Supabase stack is not running (npm run db:start)");
  return stack;
}

/** Service-role client for assertions; bypasses RLS. */
export function admin(): SupabaseClient {
  const { url, secretKey } = env();
  return createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Today's puzzle by the real clock (the server rejects future puzzles). */
export const todayPuzzle = () => puzzleNumberFor(new Date(), schedule.launchDate);

export const uniqueEmail = (tag: string) => `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

/** Names of distinct original trainees: a valid answer for `valid` cells, a wrong one otherwise. */
export function pickNames(n: number, picks: { cell: number; valid: boolean }[]): string[] {
  const answers = puzzleAnswers(n);
  const originals = [...dataset.trainees.values()].filter((t) => t.isOriginal);
  const used = new Set<string>();
  return picks.map(({ cell, valid }) => {
    const ok = new Set(answers[cell]);
    const t = originals.find((t) => !used.has(t.id) && ok.has(t.id) === valid);
    if (!t) throw new Error(`no ${valid ? "valid" : "invalid"} trainee for cell ${cell}`);
    used.add(t.id);
    return dataset.characters.get(t.characterId)!.name.en;
  });
}

export async function openToday(page: Page) {
  await skipHowToPlay(page);
  await page.goto("/");
  await expect(page.getByRole("grid")).toBeVisible();
}

async function magicLink(email: string): Promise<string> {
  let html = "";
  let id = "";
  await expect
    .poll(
      async () => {
        const search = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
        id = ((await search.json()) as { messages?: { ID: string }[] }).messages?.[0]?.ID ?? "";
        if (!id) return false;
        html = ((await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json()) as { HTML: string }).HTML;
        return true;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  // Delete it so a later sign-in with the same address can't pick up this used link.
  await fetch(`${MAILPIT}/api/v1/messages`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ IDs: [id] }),
  });
  const href = html.match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/)?.[1];
  if (!href) throw new Error("No magic link in email");
  return href.replaceAll("&amp;", "&");
}

/** Signs in through the UI and the emailed magic link (Mailpit). */
export async function signIn(page: Page, email: string) {
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Email").fill(email);
  const sent = page.getByText("Check your email");
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    // The auth server allows one email per address per second.
    await expect(sent.or(page.getByText(/Too many sign-in emails/))).toBeVisible();
    if (await sent.isVisible()) break;
    await page.waitForTimeout(1500);
  }
  await expect(sent).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await page.goto(await magicLink(email));
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByRole("button", { name: "Account" })).toBeVisible({ timeout: 15_000 });
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
}

export async function userIdFor(email: string): Promise<string> {
  const { data, error } = await admin().auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const user = data.users.find((u) => u.email === email);
  if (!user) throw new Error(`no user ${email}`);
  return user.id;
}

export async function serverSession(userId: string, puzzle: number) {
  const { data } = await admin()
    .from("daily_sessions")
    .select("guesses, status, imported")
    .eq("user_id", userId)
    .eq("puzzle_number", puzzle)
    .maybeSingle();
  return data as { guesses: unknown[]; status: string; imported: boolean } | null;
}
