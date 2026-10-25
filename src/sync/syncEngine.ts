/** Keeps the signed-in player's daily sessions and history in step with the account (research R5). */
import * as api from "@/backend/api";
import { schedule } from "@/game/data";
import { puzzleNumberFor } from "@/game/daily";
import type { GameSession, HistoryEntry } from "@/game/types";
import {
  DAILY_KEY,
  GUEST_SUBMITTED_KEY,
  HISTORY_KEY,
  readHistory,
  recordHistory,
  sharedStorage,
  SYNC_NOTICE_KEY,
} from "@/storage/local";
import { decideMerge, toLocalSession } from "./merge";
import { backoffDelay, createOutbox, type Op, type SendOutcome } from "./outbox";

export const IMPORTED_FOR_KEY = "sync:importedFor";
const IMPORT_CHUNK = 400;
const MAX_ROUNDS = 5;

const storage = sharedStorage();
const outbox = createOutbox(storage);

let userId: string | null = null;
let attempt = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let running = false;
let again: boolean | null = null;
/** Puzzles to reconcile after a flush: known server session, or undefined to fetch it. */
const toReconcile = new Map<number, { server?: api.ServerSession | null; forceAdopt: boolean }>();

const today = () => puzzleNumberFor(new Date(), schedule.launchDate);

function readLocal(puzzle: number): GameSession | null {
  const s = storage.get<GameSession>(DAILY_KEY(puzzle));
  return s && Array.isArray(s.guesses) && Array.isArray(s.cells) ? s : null;
}

function enqueueFrom(puzzle: number, session: GameSession, from: number, wasGivenUp = false) {
  for (let i = from; i < session.guesses.length; i++) {
    const g = session.guesses[i]!;
    outbox.enqueue({ puzzle, index: i, cell: g.cell, traineeId: g.traineeId });
  }
  if (session.status === "gave_up" && !wasGivenUp) {
    outbox.enqueue({ puzzle, index: session.guesses.length, giveUp: true });
  }
}

function adopt(puzzle: number, server: api.ServerSession, discardedLocal: boolean) {
  outbox.drop(puzzle);
  const session = toLocalSession(server);
  storage.set(DAILY_KEY(puzzle), session);
  if (session.status !== "in_progress") {
    recordHistory(storage, { puzzleNumber: puzzle, score: server.score, status: session.status });
    storage.set(GUEST_SUBMITTED_KEY(puzzle), true);
  }
  if (discardedLocal) storage.set(SYNC_NOTICE_KEY, puzzle);
}

async function reconcile(puzzle: number, known: api.ServerSession | null | undefined, forceAdopt: boolean) {
  let server = known;
  if (server === undefined) {
    const res = await api.getMyDaily(puzzle);
    if (!res.ok) return false;
    server = res.data;
  }
  const local = readLocal(puzzle);
  const decision = decideMerge(local, server);

  if (forceAdopt) {
    // After a permanent rejection the server's copy is the only safe state; never resend.
    if (server) {
      const discarded =
        decision.kind === "adopt-server"
          ? decision.discardedLocal
          : (local?.guesses.length ?? 0) > server.guesses.length || local?.status !== server.status;
      adopt(puzzle, server, discarded);
    }
    return true;
  }

  if (decision.kind === "adopt-server") {
    adopt(puzzle, server!, decision.discardedLocal);
  } else if (local) {
    outbox.drop(puzzle);
    const from = decision.kind === "flush-remainder" ? decision.from : 0;
    enqueueFrom(puzzle, local, from, server?.status === "gave_up");
  }
  return true;
}

async function send(op: Op): Promise<SendOutcome> {
  const res =
    "giveUp" in op
      ? await api.giveUp(op.puzzle, op.index)
      : await api.recordGuess(op.puzzle, op.index, op.cell, op.traineeId);
  if (res.ok) {
    if (res.data.result !== "conflict") return "ok";
    toReconcile.set(op.puzzle, { server: res.data.session, forceAdopt: false });
    return "conflict";
  }
  if (res.error.kind === "rejected") {
    console.error(`sync: guess for puzzle ${op.puzzle} rejected (${res.error.code})`);
    toReconcile.set(op.puzzle, { forceAdopt: true });
    return "rejected";
  }
  return "retry";
}

function localImportPayload() {
  const sessions: api.ImportSession[] = [];
  for (const key of storage.keys()) {
    const m = key.match(/^daily:(\d+)$/);
    const s = m ? readLocal(Number(m[1])) : null;
    if (!m || !s || (s.guesses.length === 0 && s.status !== "gave_up")) continue;
    sessions.push({
      puzzle_number: Number(m[1]),
      guesses: s.guesses.map((g) => ({ cell: g.cell, trainee_id: g.traineeId })),
      gave_up: s.status === "gave_up",
    });
  }
  const covered = new Set(sessions.map((s) => s.puzzle_number));
  const history = readHistory(storage)
    .filter((h) => !covered.has(h.puzzleNumber))
    .map((h) => ({ puzzle_number: h.puzzleNumber, score: h.score, status: h.status }));
  return { sessions, history };
}

async function importLocal(): Promise<boolean> {
  const { sessions, history } = localImportPayload();
  for (let i = 0; i < Math.max(sessions.length, history.length); i += IMPORT_CHUNK) {
    const res = await api.importLocal(sessions.slice(i, i + IMPORT_CHUNK), history.slice(i, i + IMPORT_CHUNK));
    if (!res.ok) return false;
  }
  return true;
}

async function refreshHistory(): Promise<boolean> {
  const res = await api.getMyHistory();
  if (!res.ok) return false;
  const account: HistoryEntry[] = res.data.map((h) => ({ puzzleNumber: h.puzzle_number, score: h.score, status: h.status }));
  const known = new Set(account.map((h) => h.puzzleNumber));
  // Local results still waiting in the outbox stay visible.
  const pendingLocal = readHistory(storage).filter((h) => !known.has(h.puzzleNumber));
  storage.set(HISTORY_KEY, [...account, ...pendingLocal].sort((a, b) => a.puzzleNumber - b.puzzleNumber));
  return true;
}

async function round(full: boolean): Promise<boolean> {
  const id = userId;
  if (full) {
    if (storage.get(IMPORTED_FOR_KEY) !== id) {
      if (!(await importLocal())) return false;
      storage.set(IMPORTED_FOR_KEY, id);
    }
    if (!(await reconcile(today(), undefined, false))) return false;
  }
  for (let i = 0; i < MAX_ROUNDS; i++) {
    if (!(await outbox.flush(send))) return false;
    if (toReconcile.size === 0) break;
    for (const [puzzle, item] of [...toReconcile]) {
      if (!(await reconcile(puzzle, item.server, item.forceAdopt))) return false;
      toReconcile.delete(puzzle);
    }
  }
  return full ? refreshHistory() : true;
}

/** Full sync: first-time import, today's session, pending guesses, history. Retries with backoff. */
async function run(full: boolean) {
  if (!userId) return;
  if (running) {
    again = (again ?? false) || full;
    return;
  }
  running = true;
  clearTimeout(timer);
  try {
    let ok: boolean;
    for (;;) {
      ok = await round(full);
      if (!ok || again === null || !userId) break;
      full = again;
      again = null;
    }
    if (ok) attempt = 0;
    else if (userId) timer = setTimeout(() => void run(true), backoffDelay(attempt++));
  } finally {
    running = false;
    again = null;
  }
}

const onOnline = () => void run(true);
const onVisible = () => {
  if (document.visibilityState === "visible") void run(true);
};

export function startSync(id: string) {
  if (userId === id) return;
  userId = id;
  attempt = 0;
  globalThis.addEventListener?.("online", onOnline);
  globalThis.document?.addEventListener("visibilitychange", onVisible);
  void run(true);
}

export function stopSync() {
  userId = null;
  clearTimeout(timer);
  toReconcile.clear();
  globalThis.removeEventListener?.("online", onOnline);
  globalThis.document?.removeEventListener("visibilitychange", onVisible);
}

/** Queues what changed in a daily session; gameplay never waits for this (FR-009). */
export function onLocalCommit(puzzle: number, prev: GameSession, next: GameSession) {
  if (!userId || next.guesses.length < prev.guesses.length) return;
  for (let i = prev.guesses.length; i < next.guesses.length; i++) {
    const g = next.guesses[i]!;
    outbox.enqueue({ puzzle, index: i, cell: g.cell, traineeId: g.traineeId });
  }
  if (next.status === "gave_up" && prev.status !== "gave_up") {
    outbox.enqueue({ puzzle, index: next.guesses.length, giveUp: true });
  }
  // Never re-submit this puzzle as a guest after signing out (research R3).
  if (next.status !== "in_progress") storage.set(GUEST_SUBMITTED_KEY(puzzle), true);
  void run(false);
}

/** FR-004: removes everything the account put on this device (settings stay). */
export function clearLocalAccountData() {
  for (const key of storage.keys()) {
    if (/^(daily:\d+|history|outbox|sync:.*)$/.test(key)) storage.remove(key);
  }
}
