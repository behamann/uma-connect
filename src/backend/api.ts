import type { PostgrestError } from "@supabase/supabase-js";
import type { SessionStatus } from "@/game/types";
import { getClient } from "./client";

export interface ServerGuess {
  cell: number;
  trainee_id: string;
  correct: boolean;
  at: string;
}

export interface ServerSession {
  puzzle_number: number;
  guesses: ServerGuess[];
  status: SessionStatus;
  score: number;
}

export const REJECTION_CODES = [
  "puzzle_unavailable",
  "unknown_trainee",
  "bad_cell",
  "game_over",
  "cell_filled",
  "trainee_used",
  "permanent_account_required",
  "name_length",
  "name_chars",
  "name_reserved",
  "name_taken",
  "already_submitted",
  "guest_only",
  "not_finished",
] as const;
export type RejectionCode = (typeof REJECTION_CODES)[number];

export type BackendError =
  /** Permanent: retrying the same call will fail again. */
  | { kind: "rejected"; code: RejectionCode }
  /** Not signed in or session expired. */
  | { kind: "auth" }
  /** Network or server problem: retry later. */
  | { kind: "unavailable"; message: string };

export type Result<T> = { ok: true; data: T } | { ok: false; error: BackendError };

export function toBackendError(error: PostgrestError): BackendError {
  const code = REJECTION_CODES.find((c) => c === error.message);
  if (code) return { kind: "rejected", code };
  if (error.message === "not_authenticated" || error.code === "PGRST301" || error.code === "42501") {
    return { kind: "auth" };
  }
  return { kind: "unavailable", message: error.message };
}

async function call<T>(fn: string, args: Record<string, unknown>): Promise<Result<T>> {
  try {
    // Function names/args are checked by the typed wrappers below.
    const { data, error } = await getClient().rpc(fn as never, args as never);
    if (error) return { ok: false, error: toBackendError(error) };
    return { ok: true, data: data as T };
  } catch (e) {
    return { ok: false, error: { kind: "unavailable", message: String(e) } };
  }
}

export type GuessResponse = { result: "correct" | "incorrect" | "conflict"; session: ServerSession | null };
export type GiveUpResponse = { result: "ok" | "conflict"; session: ServerSession | null };

export const recordGuess = (puzzle: number, index: number, cell: number, traineeId: string) =>
  call<GuessResponse>("record_guess", { p_puzzle: puzzle, p_index: index, p_cell: cell, p_trainee: traineeId });

export const giveUp = (puzzle: number, index: number) =>
  call<GiveUpResponse>("give_up", { p_puzzle: puzzle, p_index: index });

export const getMyDaily = (puzzle: number) => call<ServerSession | null>("get_my_daily", { p_puzzle: puzzle });

export interface ImportSession {
  puzzle_number: number;
  guesses: { cell: number; trainee_id: string }[];
  gave_up: boolean;
}
export interface ImportHistory {
  puzzle_number: number;
  score: number;
  status: string;
}
export type ImportResponse = { imported_sessions: number; skipped_sessions: number; imported_history: number };

export const importLocal = (sessions: ImportSession[], history: ImportHistory[]) =>
  call<ImportResponse>("import_local", { p_sessions: sessions, p_history: history });

export type AccountHistoryEntry = {
  puzzle_number: number;
  score: number;
  status: Exclude<SessionStatus, "in_progress">;
  source: "session" | "legacy";
};

export const getMyHistory = () => call<AccountHistoryEntry[]>("get_my_history", {});

export interface Profile {
  display_name: string;
  leaderboard_opt_out: boolean;
  created_at: string;
  email: string | null;
}

export const getMyProfile = () => call<Profile>("get_my_profile", {});

export const updateProfile = (changes: { displayName?: string; optOut?: boolean }) =>
  call<Profile>("update_profile", {
    p_display_name: changes.displayName ?? null,
    p_opt_out: changes.optOut ?? null,
  });

export const exportMyData = () => call<Record<string, unknown>>("export_my_data", {});

export const deleteMyAccount = () => call<null>("delete_my_account", {});

export const submitGuestResult = (puzzle: number, guesses: { cell: number; trainee_id: string }[], gaveUp: boolean) =>
  call<{ result: "ok" }>("submit_guest_result", { p_puzzle: puzzle, p_guesses: guesses, p_gave_up: gaveUp });
