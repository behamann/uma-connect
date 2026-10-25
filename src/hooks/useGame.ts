"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
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
  DAILY_KEY,
  pruneDailySessions,
  recordHistory,
  sharedStorage,
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

export const getStorage = sharedStorage;

export interface Persistence {
  storage: Storage;
  puzzleNumber: number;
  /** Called after a change is saved locally (used by account sync). */
  onCommit?: (prev: GameSession, next: GameSession) => void;
}

const noopSubscribe = () => () => {};

/** Binds the pure engine to React; persists daily sessions when `persistence` is given. */
export function useGame(grid: Grid, gridKey: string, persistence?: Persistence) {
  const resolved = useMemo(() => resolveGrid(grid, dataset), [grid]);
  const storage = persistence?.storage;
  const key = persistence ? DAILY_KEY(persistence.puzzleNumber) : null;

  const [practice, setPractice] = useState<GameSession>(() => newSession(gridKey));

  // The stored daily session can also be replaced externally (sync, other tabs).
  const subscribe = useCallback(
    (listener: () => void) => (storage && key ? storage.subscribe(key, listener) : noopSubscribe()),
    [storage, key],
  );
  const raw = useSyncExternalStore(
    subscribe,
    () => (storage && key ? storage.getRaw(key) : null),
    () => null,
  );
  const stored = useMemo(() => {
    if (raw === null) return newSession(gridKey);
    try {
      const value: unknown = JSON.parse(raw);
      return isSession(value, gridKey) ? value : newSession(gridKey);
    } catch {
      return newSession(gridKey);
    }
  }, [raw, gridKey]);
  const session = persistence ? stored : practice;

  const puzzleNumber = persistence?.puzzleNumber;
  useEffect(() => {
    if (storage && puzzleNumber !== undefined) pruneDailySessions(storage, puzzleNumber);
  }, [storage, puzzleNumber]);

  const commit = (next: GameSession) => {
    if (!persistence) {
      setPractice(next);
      return;
    }
    const prev = session;
    persistence.storage.set(DAILY_KEY(persistence.puzzleNumber), next);
    if (isFinished(next)) {
      recordHistory(persistence.storage, {
        puzzleNumber: persistence.puzzleNumber,
        score: score(next),
        status: next.status as HistoryEntry["status"],
      });
    }
    persistence.onCommit?.(prev, next);
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
