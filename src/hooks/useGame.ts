"use client";

import { useMemo, useState } from "react";
import { dataset, schedule } from "@/game/data";
import { dailyGrid, puzzleNumberFor } from "@/game/daily";
import { resolveGrid } from "@/game/grid";
import {
  giveUp as giveUpSession,
  isFinished,
  newSession,
  score,
  submitGuess,
  type GuessOutcome,
} from "@/game/session";
import { CELL_COUNT, type GameSession, type Grid, type HistoryEntry, type TraineeId } from "@/game/types";
import {
  createStorage,
  DAILY_KEY,
  pruneDailySessions,
  recordHistory,
  type Storage,
} from "@/storage/local";

export type DailyPuzzle =
  | { status: "ok"; puzzleNumber: number; grid: Grid }
  | { status: "missing"; puzzleNumber: number };

export function loadDailyPuzzle(now: Date): DailyPuzzle {
  const puzzleNumber = puzzleNumberFor(now, schedule.launchDate);
  const grid = dailyGrid(schedule, puzzleNumber);
  return grid ? { status: "ok", puzzleNumber, grid } : { status: "missing", puzzleNumber };
}

function isSession(value: unknown, gridKey: string): value is GameSession {
  const s = value as GameSession | undefined;
  return (
    !!s &&
    s.gridKey === gridKey &&
    Array.isArray(s.cells) &&
    s.cells.length === CELL_COUNT &&
    Array.isArray(s.guesses) &&
    typeof s.status === "string"
  );
}

let sharedStorage: Storage | undefined;
export function getStorage(): Storage {
  sharedStorage ??= createStorage();
  return sharedStorage;
}

export interface Persistence {
  storage: Storage;
  puzzleNumber: number;
}

/** Binds the pure engine to React; persists daily sessions when `persistence` is given. */
export function useGame(grid: Grid, gridKey: string, persistence?: Persistence) {
  const resolved = useMemo(() => resolveGrid(grid, dataset), [grid]);

  const [session, setSession] = useState<GameSession>(() => {
    if (!persistence) return newSession(gridKey);
    pruneDailySessions(persistence.storage, persistence.puzzleNumber);
    const stored = persistence.storage.get<unknown>(DAILY_KEY(persistence.puzzleNumber));
    return isSession(stored, gridKey) ? stored : newSession(gridKey);
  });

  const commit = (next: GameSession) => {
    setSession(next);
    if (!persistence) return;
    persistence.storage.set(DAILY_KEY(persistence.puzzleNumber), next);
    if (isFinished(next)) {
      recordHistory(persistence.storage, {
        puzzleNumber: persistence.puzzleNumber,
        score: score(next),
        status: next.status as HistoryEntry["status"],
      });
    }
  };

  const guess = (cell: number, traineeId: TraineeId): { outcome: GuessOutcome; finished: boolean } => {
    const result = submitGuess(session, resolved, cell, traineeId, new Date());
    if (result.outcome !== "rejected") commit(result.session);
    return { outcome: result.outcome, finished: isFinished(result.session) };
  };

  const giveUp = () => {
    const next = giveUpSession(session);
    if (next !== session) commit(next);
  };

  return { resolved, session, guess, giveUp, reset: () => commit(newSession(gridKey)) };
}

export type GameController = ReturnType<typeof useGame>;
