import {
  CELL_COUNT,
  MAX_GUESSES,
  type GameSession,
  type ResolvedGrid,
  type TraineeId,
} from "./types";

export type GuessOutcome = "correct" | "incorrect" | "rejected";

export function newSession(gridKey: string): GameSession {
  return { gridKey, cells: Array(CELL_COUNT).fill(null), guesses: [], status: "in_progress" };
}

export function remainingGuesses(s: GameSession): number {
  return MAX_GUESSES - s.guesses.length;
}

export function score(s: GameSession): number {
  return s.cells.filter((c) => c !== null).length;
}

export function isFinished(s: GameSession): boolean {
  return s.status !== "in_progress";
}

export function isUsed(s: GameSession, traineeId: TraineeId): boolean {
  return s.cells.includes(traineeId);
}

export function submitGuess(
  s: GameSession,
  r: ResolvedGrid,
  cell: number,
  traineeId: TraineeId,
  now: Date,
): { session: GameSession; outcome: GuessOutcome } {
  if (
    isFinished(s) ||
    !Number.isInteger(cell) ||
    cell < 0 ||
    cell >= CELL_COUNT ||
    s.cells[cell] !== null ||
    isUsed(s, traineeId) ||
    remainingGuesses(s) <= 0
  ) {
    return { session: s, outcome: "rejected" };
  }

  const correct = r.answers[Math.floor(cell / 3)]?.[cell % 3]?.includes(traineeId) ?? false;
  const cells = [...s.cells];
  if (correct) cells[cell] = traineeId;
  const guesses = [...s.guesses, { cell, traineeId, correct, at: now.toISOString() }];

  const status = cells.every((c) => c !== null)
    ? "completed"
    : guesses.length >= MAX_GUESSES
      ? "out_of_guesses"
      : "in_progress";

  return {
    session: { ...s, cells, guesses, status },
    outcome: correct ? "correct" : "incorrect",
  };
}

export function giveUp(s: GameSession): GameSession {
  return isFinished(s) ? s : { ...s, status: "gave_up" };
}
