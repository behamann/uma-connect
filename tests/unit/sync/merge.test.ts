import { describe, expect, it } from "vitest";
import type { ServerSession } from "@/backend/api";
import type { GameSession } from "@/game/types";
import { decideMerge, toLocalSession } from "@/sync/merge";

const AT = "2026-10-25T00:00:00.000Z";

function local(guesses: [number, string, boolean][], status: GameSession["status"] = "in_progress"): GameSession {
  const cells: (string | null)[] = Array(9).fill(null);
  for (const [cell, id, ok] of guesses) if (ok) cells[cell] = id;
  return {
    gridKey: "daily:1",
    cells,
    guesses: guesses.map(([cell, traineeId, correct]) => ({ cell, traineeId, correct, at: AT })),
    status,
  };
}

function server(guesses: [number, string, boolean][], status: ServerSession["status"] = "in_progress"): ServerSession {
  return {
    puzzle_number: 1,
    guesses: guesses.map(([cell, trainee_id, correct]) => ({ cell, trainee_id, correct, at: AT })),
    status,
    score: guesses.filter(([, , ok]) => ok).length,
  };
}

describe("decideMerge", () => {
  it("pushes local data when the account has no session", () => {
    expect(decideMerge(local([[0, "a", true]]), null)).toEqual({ kind: "push-local" });
    expect(decideMerge(null, null)).toEqual({ kind: "push-local" });
  });

  it("flushes the local remainder when the server session is a prefix", () => {
    const l = local([[0, "a", true], [1, "b", false], [2, "c", true]]);
    expect(decideMerge(l, server([[0, "a", true]]))).toEqual({ kind: "flush-remainder", from: 1 });
    expect(decideMerge(l, server([]))).toEqual({ kind: "flush-remainder", from: 0 });
    expect(decideMerge(l, server([[0, "a", true], [1, "b", false], [2, "c", true]]))).toEqual({
      kind: "flush-remainder",
      from: 3,
    });
  });

  it("flushes a local give-up on top of identical guesses", () => {
    expect(decideMerge(local([[0, "a", true]], "gave_up"), server([[0, "a", true]]))).toEqual({
      kind: "flush-remainder",
      from: 1,
    });
  });

  it("adopts a longer server session without discarding anything", () => {
    expect(decideMerge(local([[0, "a", true]]), server([[0, "a", true], [1, "b", true]]))).toEqual({
      kind: "adopt-server",
      discardedLocal: false,
    });
    expect(decideMerge(null, server([[0, "a", true]]))).toEqual({ kind: "adopt-server", discardedLocal: false });
  });

  it("adopts the server and reports discarded local guesses when the sessions diverge", () => {
    expect(decideMerge(local([[0, "a", true], [1, "x", false]]), server([[0, "a", true], [1, "b", true]]))).toEqual({
      kind: "adopt-server",
      discardedLocal: true,
    });
    expect(decideMerge(local([[4, "z", true]]), server([[0, "a", true]]))).toEqual({
      kind: "adopt-server",
      discardedLocal: true,
    });
  });

  it("adopts a finished server session even when local has more guesses", () => {
    expect(decideMerge(local([[0, "a", true], [1, "b", true]]), server([[0, "a", true]], "gave_up"))).toEqual({
      kind: "adopt-server",
      discardedLocal: true,
    });
    expect(decideMerge(local([[0, "a", true]]), server([[0, "a", true]], "gave_up"))).toEqual({
      kind: "adopt-server",
      discardedLocal: false,
    });
  });
});

describe("toLocalSession", () => {
  it("rebuilds cells and guesses from the server session", () => {
    const s = toLocalSession(server([[0, "a", true], [1, "b", false]]));
    expect(s.gridKey).toBe("daily:1");
    expect(s.cells[0]).toBe("a");
    expect(s.cells[1]).toBeNull();
    expect(s.guesses).toEqual([
      { cell: 0, traineeId: "a", correct: true, at: AT },
      { cell: 1, traineeId: "b", correct: false, at: AT },
    ]);
  });
});
