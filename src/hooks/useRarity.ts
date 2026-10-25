"use client";

import { useEffect, useState } from "react";
import { backendEnabled } from "@/backend/config";
import { guestSubmission } from "@/backend/load";
import { fetchRarity, RARITY_THRESHOLD } from "@/backend/public";
import type { RarityData } from "@/game/rarity";

export type RarityState =
  | { status: "practice" }
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "insufficient"; finishedGames: number; threshold: number }
  | { status: "ready"; data: RarityData };

/** Loads rarity for a finished daily puzzle (after this device's guest result is submitted). */
export function useRarity(puzzleNumber: number | null, finished: boolean): RarityState {
  const [loaded, setLoaded] = useState<{ puzzle: number; state: RarityState } | null>(null);

  useEffect(() => {
    if (puzzleNumber === null || !finished || !backendEnabled) return;
    let active = true;
    void guestSubmission(puzzleNumber)
      .then(() => fetchRarity(puzzleNumber))
      .then((data) => {
        if (!active) return;
        const state: RarityState = !data
          ? { status: "unavailable" }
          : data.cells
            ? { status: "ready", data }
            : { status: "insufficient", finishedGames: data.finishedGames, threshold: RARITY_THRESHOLD };
        setLoaded({ puzzle: puzzleNumber, state });
      });
    return () => {
      active = false;
    };
  }, [puzzleNumber, finished]);

  if (puzzleNumber === null) return { status: "practice" };
  if (!backendEnabled) return { status: "unavailable" };
  if (loaded?.puzzle === puzzleNumber) return loaded.state;
  return { status: "loading" };
}
