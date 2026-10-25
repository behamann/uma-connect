import type { GameSession } from "@/game/types";
import { withBasePath } from "@/lib/basePath";
import { GUEST_SUBMITTED_KEY, sharedStorage } from "@/storage/local";
import { deleteMyAccount, submitGuestResult } from "./api";
import { getClient } from "./client";
import { clearLocalAccountData, startSync, stopSync } from "@/sync/syncEngine";

export interface AccountUser {
  id: string;
  email: string | null;
}

export type SignInError = "rate_limited" | "invalid_email" | "unavailable";

export function callbackUrl(): string {
  return `${window.location.origin}${withBasePath("/auth/callback/")}`;
}

export async function signInWithEmail(email: string): Promise<{ ok: true } | { ok: false; error: SignInError }> {
  try {
    const { error } = await getClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl(), shouldCreateUser: true },
    });
    if (!error) return { ok: true };
    if (error.status === 429) return { ok: false, error: "rate_limited" };
    if (error.status === 400 || error.status === 422) return { ok: false, error: "invalid_email" };
    return { ok: false, error: "unavailable" };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}

// TODO(FR-002): Google/Discord via signInWithOAuth({ provider, options: { redirectTo: callbackUrl() } }).

/** Completes the PKCE magic-link flow; fails when the link was opened in another browser. */
export async function exchangeCode(code: string): Promise<boolean> {
  try {
    const { error } = await getClient().auth.exchangeCodeForSession(code);
    return !error;
  } catch {
    return false;
  }
}

export async function signOut(): Promise<void> {
  stopSync();
  await getClient().auth.signOut({ scope: "local" });
  clearLocalAccountData();
}

/** FR-018: deletes the account on the server, then everything it left on this device. */
export async function deleteAccount(): Promise<boolean> {
  const res = await deleteMyAccount();
  if (!res.ok) return false;
  await signOut();
  return true;
}

/** Anonymous session used only to dedupe guest rarity submissions (research R3). */
export async function ensureGuestSession(): Promise<"guest" | "permanent" | null> {
  const client = getClient();
  const { data } = await client.auth.getSession();
  if (data.session) return data.session.user.is_anonymous ? "guest" : "permanent";
  const { error } = await client.auth.signInAnonymously();
  return error ? null : "guest";
}

/** Sends a finished guest daily game to the rarity stats once per device; failures are ignored. */
export async function submitAsGuest(puzzle: number, session: GameSession): Promise<void> {
  const storage = sharedStorage();
  if (storage.get(GUEST_SUBMITTED_KEY(puzzle))) return;
  if ((await ensureGuestSession()) !== "guest") return;
  const res = await submitGuestResult(
    puzzle,
    session.guesses.map((g) => ({ cell: g.cell, trainee_id: g.traineeId })),
    session.status === "gave_up",
  );
  if (res.ok || (res.error.kind === "rejected" && res.error.code === "already_submitted")) {
    storage.set(GUEST_SUBMITTED_KEY(puzzle), true);
  }
}

/** Reports the permanent (non-guest) user and keeps sync running while one is signed in. */
export function onAuthChange(callback: (user: AccountUser | null) => void): () => void {
  const { data } = getClient().auth.onAuthStateChange((_event, session) => {
    const u = session?.user;
    const user = u && !u.is_anonymous ? { id: u.id, email: u.email ?? null } : null;
    // Defer: supabase-js must not be called from inside this callback.
    setTimeout(() => {
      if (user) startSync(user.id);
      else stopSync();
      callback(user);
    }, 0);
  });
  return () => data.subscription.unsubscribe();
}
