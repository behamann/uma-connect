"use client";

import { useEffect, useState } from "react";
import { backendEnabled } from "@/backend/config";
import { loadBackend } from "@/backend/load";
import { fetchLeaderboard, type Leaderboard, type LeaderboardPeriod } from "@/backend/public";
import { useAuth } from "./useAuth";

export type LeaderboardState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "ready"; data: Leaderboard; fetchedAt: number };

/** Signed-in players query through the SDK to get their own rank; guests use the public endpoint. */
export function useLeaderboard(period: LeaderboardPeriod, key: string): LeaderboardState {
  const auth = useAuth();
  const viewer = auth.status === "signed-in" ? auth.user.id : auth.status === "loading" ? null : "guest";
  const id = `${period}:${key}:${viewer}`;
  const [loaded, setLoaded] = useState<{ id: string; state: LeaderboardState } | null>(null);

  useEffect(() => {
    if (!backendEnabled || viewer === null) return;
    let active = true;
    const request =
      viewer === "guest"
        ? fetchLeaderboard(period, key)
        : loadBackend()
            .then((b) => b.api.getLeaderboard(period, key))
            .then((res) => (res.ok ? res.data : null))
            .catch(() => null);
    void request.then((data) => {
      if (!active) return;
      setLoaded({ id, state: data ? { status: "ready", data, fetchedAt: Date.now() } : { status: "unavailable" } });
    });
    return () => {
      active = false;
    };
  }, [id, period, key, viewer]);

  if (!backendEnabled) return { status: "unavailable" };
  return loaded?.id === id ? loaded.state : { status: "loading" };
}
