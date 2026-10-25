import type { GameSession } from "@/game/types";
import { AUTH_STORAGE_KEY, backendEnabled } from "./config";

export type Backend = typeof import("./bundle");

let pending: Promise<Backend> | undefined;

/** Lazily loads the Supabase SDK and sync code (kept out of the initial bundle). */
export function loadBackend(): Promise<Backend> {
  if (!backendEnabled) return Promise.reject(new Error("backend disabled"));
  pending ??= import("./bundle");
  return pending;
}

/** True when a permanent (non-guest) session is stored, without loading the SDK. */
export function hasStoredSession(): boolean {
  try {
    const raw = globalThis.localStorage?.getItem(AUTH_STORAGE_KEY);
    if (!raw) return false;
    const stored = JSON.parse(raw) as { user?: { is_anonymous?: boolean } | null };
    return !!stored.user && !stored.user.is_anonymous;
  } catch {
    return false;
  }
}

const guestSubmissions = new Map<number, Promise<void>>();

/**
 * Forwards a saved daily change: to account sync when signed in, or (once finished) to the
 * anonymous rarity stats for guests. Guests only load the backend after finishing.
 */
export function notifyDailyCommit(puzzle: number, prev: GameSession, next: GameSession): void {
  if (!backendEnabled) return;
  if (hasStoredSession()) {
    void loadBackend().then((b) => b.sync.onLocalCommit(puzzle, prev, next));
  } else if (prev.status === "in_progress" && next.status !== "in_progress") {
    guestSubmissions.set(
      puzzle,
      loadBackend()
        .then((b) => b.auth.submitAsGuest(puzzle, next))
        .catch(() => undefined),
    );
  }
}

/** Resolves once this tab's guest submission for the puzzle (if any) has finished. */
export function guestSubmission(puzzle: number): Promise<void> {
  return guestSubmissions.get(puzzle) ?? Promise.resolve();
}
