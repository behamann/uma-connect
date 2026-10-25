# Contract: Game Engine (`src/game/`)

Pure TypeScript; MUST NOT import React, Next.js, or DOM APIs. Consumed by the UI (`useGame`),
scripts, and tests — and later by a backend. Signatures are the contract; bodies are not.

```ts
// dataset.ts
loadDataset(raw: { characters: unknown; trainees: unknown; categories: unknown }): Dataset; // throws on invalid
interface Dataset {
  characters: Map<CharacterId, Character>;
  trainees: Map<TraineeId, TraineeVersion>;
  categories: Map<CategoryId, Category>;
}

// categories.ts
matches(category: Category, trainee: TraineeVersion, character: Character): boolean;

// grid.ts
resolveGrid(grid: Grid, ds: Dataset): ResolvedGrid;          // answers per cell
checkGrid(resolved: ResolvedGrid, ds: Dataset): GridCheck;   // { ok: boolean; problems: string[] }

// generator.ts
generateGrid(ds: Dataset, seed: string, opts?: { exclude?: Set<string>; maxAttempts?: number }): Grid | null;

// daily.ts
puzzleNumberFor(dateUtc: Date, launchDate: string): number;
dailyGrid(schedule: Schedule, puzzleNumber: number): Grid | null;
msUntilNextPuzzle(now: Date): number;

// session.ts
newSession(gridKey: string): GameSession;
submitGuess(s: GameSession, r: ResolvedGrid, cell: number, traineeId: TraineeId, now: Date):
  { session: GameSession; outcome: "correct" | "incorrect" | "rejected" };
giveUp(s: GameSession): GameSession;
remainingGuesses(s: GameSession): number;
score(s: GameSession): number;            // filled cells 0–9
isFinished(s: GameSession): boolean;

// search.ts
buildSearchIndex(ds: Dataset, locale: string): SearchIndex;
search(index: SearchIndex, query: string, limit?: number): TraineeId[];  // default limit 8

// share.ts
shareText(s: GameSession, puzzleNumber: number, url: string, t: ShareStrings): string;

// stats.ts
computeStats(history: HistoryEntry[], todayPuzzle: number): PlayerStatistics;
```

## Behavioural guarantees (unit-tested)

- `submitGuess` returns `rejected` (state unchanged) when: game finished, cell filled, or trainee
  already in `cells`. Otherwise appends to `guesses` and applies the transition in
  [data-model.md](../data-model.md#gamesession-persisted-per-daily-puzzle-in-memory-for-practice).
- `generateGrid` is deterministic for a given `(dataset, seed, opts)`.
- Every grid returned by `generateGrid` passes `checkGrid`.
- `search` is case/diacritic/punctuation-insensitive and never filters by cell validity (FR-004).
- `puzzleNumberFor` changes exactly at 00:00 UTC.
