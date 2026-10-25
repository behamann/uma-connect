/** Pure decision of how to reconcile a local daily session with the account's (research R5). */
import type { ServerSession } from "@/backend/api";
import { CELL_COUNT, type GameSession } from "@/game/types";

export type MergeDecision =
  | { kind: "push-local" }
  | { kind: "flush-remainder"; from: number }
  | { kind: "adopt-server"; discardedLocal: boolean };

const sameGuess = (a: { cell: number; traineeId: string }, b: { cell: number; trainee_id: string }) =>
  a.cell === b.cell && a.traineeId === b.trainee_id;

export function decideMerge(local: GameSession | null, server: ServerSession | null): MergeDecision {
  if (!server) return { kind: "push-local" };
  const localGuesses = local?.guesses ?? [];
  const n = server.guesses.length;

  const serverIsPrefix = n <= localGuesses.length && server.guesses.every((g, i) => sameGuess(localGuesses[i]!, g));
  if (serverIsPrefix && server.status === "in_progress") return { kind: "flush-remainder", from: n };

  const localIsPrefix =
    localGuesses.length <= n && localGuesses.every((g, i) => sameGuess(g, server.guesses[i]!));
  const localGaveUpAlone = local?.status === "gave_up" && server.status !== "gave_up";
  return { kind: "adopt-server", discardedLocal: !localIsPrefix || localGaveUpAlone };
}

export function toLocalSession(server: ServerSession): GameSession {
  const cells: (string | null)[] = Array(CELL_COUNT).fill(null);
  for (const g of server.guesses) if (g.correct) cells[g.cell] = g.trainee_id;
  return {
    gridKey: `daily:${server.puzzle_number}`,
    cells,
    guesses: server.guesses.map((g) => ({ cell: g.cell, traineeId: g.trainee_id, correct: g.correct, at: g.at })),
    status: server.status,
  };
}
