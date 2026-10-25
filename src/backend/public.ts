// Public read-only endpoint called without the Supabase SDK, so guests don't download it for rarity.
import type { RarityData } from "@/game/rarity";
import { backendEnabled, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

export const RARITY_THRESHOLD = 20;

/** Null when the backend is disabled or unreachable; `cells` is null below the threshold. */
export async function fetchRarity(puzzle: number): Promise<RarityData | null> {
  if (!backendEnabled) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_rarity`, {
      method: "POST",
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ p_puzzle: puzzle }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      finished_games: number;
      cells: { cell: number; trainee_id: string; picks: number }[] | null;
    };
    return {
      finishedGames: data.finished_games,
      cells: data.cells?.map((c) => ({ cell: c.cell, traineeId: c.trainee_id, picks: c.picks })) ?? null,
    };
  } catch {
    return null;
  }
}
