// Public read-only endpoints called without the Supabase SDK, so guests don't download it.
import type { RarityData } from "@/game/rarity";
import { backendEnabled, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

export const RARITY_THRESHOLD = 20;

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  if (!backendEnabled) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Null when the backend is disabled or unreachable; `cells` is null below the threshold. */
export async function fetchRarity(puzzle: number): Promise<RarityData | null> {
  const data = await rpc<{
    finished_games: number;
    cells: { cell: number; trainee_id: string; picks: number }[] | null;
  }>("get_rarity", { p_puzzle: puzzle });
  if (!data) return null;
  return {
    finishedGames: data.finished_games,
    cells: data.cells?.map((c) => ({ cell: c.cell, traineeId: c.trainee_id, picks: c.picks })) ?? null,
  };
}

export type LeaderboardPeriod = "daily" | "week" | "month" | "all";

export interface LeaderboardEntry {
  rank: number;
  display_name: string;
  score: number;
  rarity: number;
  games?: number;
  perfect?: number;
}

export interface Leaderboard {
  updated_at: string | null;
  entries: LeaderboardEntry[];
  me: LeaderboardEntry | null;
}

/** Anonymous view (no own rank); null when the backend is disabled or unreachable. */
export const fetchLeaderboard = (period: LeaderboardPeriod, key: string) =>
  rpc<Leaderboard>("get_leaderboard", { p_period: period, p_key: key });
