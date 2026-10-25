/**
 * Constitution IV parity: the database must judge guesses exactly like src/game/session.ts.
 * Needs the local stack: npm run db:start && npm run backend:sync-puzzles && npm run test:integration
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { localStack } from "../../scripts/backend/local-stack";
import { dataset, schedule } from "@/game/data";
import { dailyGrid, puzzleNumberFor } from "@/game/daily";
import { resolveGrid } from "@/game/grid";
import { createRng } from "@/game/rng";
import { giveUp, isFinished, newSession, score, submitGuess } from "@/game/session";
import type { GameSession, ResolvedGrid } from "@/game/types";

const stack = localStack();
const SEQUENCES = 200;

interface ServerSession {
  guesses: { cell: number; trainee_id: string; correct: boolean }[];
  status: string;
  score: number;
}

function serverCells(s: ServerSession): (string | null)[] {
  const cells: (string | null)[] = Array(9).fill(null);
  for (const g of s.guesses) if (g.correct) cells[g.cell] = g.trainee_id;
  return cells;
}

describe.skipIf(!stack)("backend parity with the engine", () => {
  let admin: SupabaseClient;
  let player: SupabaseClient;
  let guest: SupabaseClient;
  let userId: string;
  let guestId: string;
  const puzzle = Math.min(
    Math.max(puzzleNumberFor(new Date(), schedule.launchDate), 1),
    schedule.puzzles.at(-1)?.puzzleNumber ?? 1,
  );

  beforeAll(async () => {
    const { url, secretKey, publishableKey } = stack!;
    const opts = { auth: { persistSession: false, autoRefreshToken: false } };
    admin = createClient(url, secretKey, opts);
    player = createClient(url, publishableKey, opts);
    const email = `parity-${Date.now()}@example.com`;
    const password = `Pw-${crypto.randomUUID()}`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error) throw created.error;
    userId = created.data.user.id;
    const signedIn = await player.auth.signInWithPassword({ email, password });
    if (signedIn.error) throw signedIn.error;
    guest = createClient(url, publishableKey, opts);
    const anonymous = await guest.auth.signInAnonymously();
    if (anonymous.error) throw anonymous.error;
    guestId = anonymous.data.user!.id;
  });

  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId);
    if (guestId) await admin.auth.admin.deleteUser(guestId);
  });

  it("stores the same answers as resolveGrid for every scheduled puzzle", async () => {
    for (const entry of schedule.puzzles) {
      const resolved = resolveGrid(dailyGrid(schedule, entry.puzzleNumber)!, dataset);
      const data: { cell: number; trainee_id: string }[] = [];
      for (let from = 0; ; from += 1000) {
        const page = await admin
          .from("puzzle_answers")
          .select("cell, trainee_id")
          .eq("puzzle_number", entry.puzzleNumber)
          .order("cell")
          .order("trainee_id")
          .range(from, from + 999);
        expect(page.error).toBeNull();
        data.push(...(page.data ?? []));
        if ((page.data ?? []).length < 1000) break;
      }
      const db = Array.from({ length: 9 }, (_, cell) =>
        data
          .filter((a) => a.cell === cell)
          .map((a) => a.trainee_id)
          .sort(),
      );
      const engine = resolved.answers.flat().map((ids) => [...ids].sort());
      expect(db, `puzzle #${entry.puzzleNumber}`).toEqual(engine);
    }
  });

  it(`judges ${SEQUENCES} random guess sequences like the engine`, { timeout: 600_000 }, async () => {
    const resolved: ResolvedGrid = resolveGrid(dailyGrid(schedule, puzzle)!, dataset);
    const allTrainees = [...dataset.trainees.keys()];

    for (let seq = 0; seq < SEQUENCES; seq++) {
      const rng = createRng(`parity-${seq}`);
      const pick = <T>(items: readonly T[]): T => items[Math.floor(rng() * items.length)]!;
      await admin.from("daily_sessions").delete().eq("user_id", userId).eq("puzzle_number", puzzle);

      let local: GameSession = newSession(`daily:${puzzle}`);
      let server: ServerSession | null = null;

      for (let step = 0; step < 14 && !isFinished(local); step++) {
        const index = local.guesses.length;
        if (rng() < 0.04) {
          local = giveUp(local);
          const { data, error } = await player.rpc("give_up", { p_puzzle: puzzle, p_index: index });
          expect(error).toBeNull();
          expect(data.result).toBe("ok");
          server = data.session;
          break;
        }
        const cell = Math.floor(rng() * 9);
        const roll = rng();
        const used = local.cells.filter((c): c is string => c !== null);
        const traineeId =
          roll < 0.55
            ? pick(resolved.answers[Math.floor(cell / 3)]![cell % 3]!)
            : roll < 0.7 && used.length
              ? pick(used)
              : pick(allTrainees);

        const result = submitGuess(local, resolved, cell, traineeId, new Date());
        const { data, error } = await player.rpc("record_guess", {
          p_puzzle: puzzle,
          p_index: index,
          p_cell: cell,
          p_trainee: traineeId,
        });
        const ctx = `seq ${seq} step ${step} cell ${cell} ${traineeId}`;
        if (result.outcome === "rejected") {
          expect(error?.message, ctx).toMatch(/^(cell_filled|trainee_used|game_over)$/);
          continue;
        }
        expect(error, ctx).toBeNull();
        expect(data.result, ctx).toBe(result.outcome);
        local = result.session;
        server = data.session;
      }

      if (!server) continue;
      expect(server.status, `seq ${seq}`).toBe(local.status);
      expect(server.score, `seq ${seq}`).toBe(score(local));
      expect(serverCells(server), `seq ${seq}`).toEqual(local.cells);
      expect(server.guesses.map((g) => [g.cell, g.trainee_id, g.correct])).toEqual(
        local.guesses.map((g) => [g.cell, g.traineeId, g.correct]),
      );

      // The same accepted sequence replayed by import_local must end in the same state.
      await admin.from("daily_sessions").delete().eq("user_id", userId).eq("puzzle_number", puzzle);
      const imported = await player.rpc("import_local", {
        p_sessions: [
          {
            puzzle_number: puzzle,
            guesses: local.guesses.map((g) => ({ cell: g.cell, trainee_id: g.traineeId })),
            gave_up: local.status === "gave_up",
          },
        ],
        p_history: [],
      });
      expect(imported.error).toBeNull();
      expect(imported.data.imported_sessions, `seq ${seq} import`).toBe(1);
      const replay = (await player.rpc("get_my_daily", { p_puzzle: puzzle })).data as ServerSession;
      expect(replay.status, `seq ${seq} import`).toBe(local.status);
      expect(replay.score, `seq ${seq} import`).toBe(score(local));
      expect(serverCells(replay), `seq ${seq} import`).toEqual(local.cells);

      // Finished games submitted by a guest are replayed and judged the same way.
      if (local.status === "in_progress") continue;
      await admin.from("daily_sessions").delete().eq("user_id", guestId).eq("puzzle_number", puzzle);
      const submitted = await guest.rpc("submit_guest_result", {
        p_puzzle: puzzle,
        p_guesses: local.guesses.map((g) => ({ cell: g.cell, trainee_id: g.traineeId })),
        p_gave_up: local.status === "gave_up",
      });
      expect(submitted.error, `seq ${seq} guest`).toBeNull();
      const { data: guestRow } = await admin
        .from("daily_sessions")
        .select("status, score")
        .eq("user_id", guestId)
        .eq("puzzle_number", puzzle)
        .single();
      expect(guestRow, `seq ${seq} guest`).toEqual({ status: local.status, score: score(local) });
    }
  });
});
