import { describe, expect, it } from "vitest";
import { giveUp, isFinished, newSession, remainingGuesses, score, submitGuess } from "@/game/session";
import type { ResolvedGrid } from "@/game/types";

const NOW = new Date("2026-11-01T12:00:00Z");

// Cell i accepts "a{i}" and "b{i}"; "shared" is valid in cells 0 and 1.
const resolved: ResolvedGrid = {
  grid: { rows: ["r0", "r1", "r2"], cols: ["c0", "c1", "c2"], kind: "practice" },
  answers: [0, 1, 2].map((r) =>
    [0, 1, 2].map((c) => {
      const i = r * 3 + c;
      return i <= 1 ? [`a${i}`, `b${i}`, "shared"] : [`a${i}`, `b${i}`];
    }),
  ) as ResolvedGrid["answers"],
};

describe("session", () => {
  it("starts empty with 9 guesses", () => {
    const s = newSession("daily:1");
    expect(s.cells).toEqual(Array(9).fill(null));
    expect(remainingGuesses(s)).toBe(9);
    expect(score(s)).toBe(0);
  });

  it("a correct guess fills the cell and consumes a guess", () => {
    const { session, outcome } = submitGuess(newSession("x"), resolved, 4, "a4", NOW);
    expect(outcome).toBe("correct");
    expect(session.cells[4]).toBe("a4");
    expect(remainingGuesses(session)).toBe(8);
    expect(session.guesses[0]).toEqual({ cell: 4, traineeId: "a4", correct: true, at: NOW.toISOString() });
  });

  it("an incorrect guess leaves the cell empty but consumes a guess", () => {
    const { session, outcome } = submitGuess(newSession("x"), resolved, 4, "a5", NOW);
    expect(outcome).toBe("incorrect");
    expect(session.cells[4]).toBeNull();
    expect(remainingGuesses(session)).toBe(8);
  });

  it("rejects a filled cell, a used trainee, a bad cell, and finished games without consuming a guess", () => {
    let s = submitGuess(newSession("x"), resolved, 0, "shared", NOW).session;
    for (const [cell, id] of [
      [0, "a0"],
      [1, "shared"],
      [9, "a0"],
      [-1, "a0"],
    ] as const) {
      const r = submitGuess(s, resolved, cell, id, NOW);
      expect(r.outcome).toBe("rejected");
      expect(r.session).toBe(s);
    }
    s = giveUp(s);
    expect(submitGuess(s, resolved, 2, "a2", NOW).outcome).toBe("rejected");
  });

  it("completes when all 9 cells are filled", () => {
    let s = newSession("x");
    for (let i = 0; i < 9; i++) s = submitGuess(s, resolved, i, `a${i}`, NOW).session;
    expect(s.status).toBe("completed");
    expect(score(s)).toBe(9);
    expect(isFinished(s)).toBe(true);
  });

  it("ends as out_of_guesses after 9 guesses without filling the grid", () => {
    let s = newSession("x");
    for (let i = 0; i < 8; i++) s = submitGuess(s, resolved, i, `a${i}`, NOW).session;
    s = submitGuess(s, resolved, 8, "wrong", NOW).session;
    expect(s.status).toBe("out_of_guesses");
    expect(score(s)).toBe(8);
  });

  it("give up ends the game keeping current state", () => {
    const s = giveUp(submitGuess(newSession("x"), resolved, 3, "a3", NOW).session);
    expect(s.status).toBe("gave_up");
    expect(score(s)).toBe(1);
    expect(giveUp(s)).toBe(s);
  });
});
