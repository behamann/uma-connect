# Contract: Client Sync & Backend Modules

## `src/game/rarity.ts` (pure, engine module)

```ts
interface RarityData { finishedGames: number; cells: { cell: number; traineeId: string; picks: number }[] | null }
cellRarity(data: RarityData, cell: number, traineeId: string | null): number | null; // % 0–100, null if unavailable
rarityScore(data: RarityData, cells: (string | null)[]): number | null;            // Σ, empty = 100
```

## `src/sync/merge.ts` (pure)

```ts
type MergeDecision =
  | { kind: "push-local" }                       // no server session: import/flush local
  | { kind: "flush-remainder"; from: number }    // server guesses are a prefix of local
  | { kind: "adopt-server"; discardedLocal: boolean };
decideMerge(local: GameSession | null, server: ServerSession | null): MergeDecision;
```
Prefix = same length-n sequence of `{cell, traineeId}`; `discardedLocal` true when local had
guesses not in the server session.

## `src/sync/outbox.ts`

```ts
enqueue(op: { puzzle: number; index: number; cell: number; traineeId: string } | { puzzle: number; index: number; giveUp: true }): void;
pending(puzzle?: number): Op[];
drop(puzzle: number): void;              // after conflict/adopt
flush(send: (op: Op) => Promise<"ok" | "conflict" | "rejected" | "retry">): Promise<void>; // FIFO, stops only on retry
```
Backoff 1 s → 60 s; triggers: enqueue, `online`, `visibilitychange`, sign-in.
`conflict` and `rejected` both drop the puzzle's remaining ops and adopt the server session;
`rejected` (permanent error codes) is never retried, so the queue cannot get stuck.

## `src/backend/*` (lazy)

```ts
// config.ts
export const backendEnabled: boolean; // both NEXT_PUBLIC_SUPABASE_URL and _PUBLISHABLE_KEY set
// auth.ts
signInWithEmail(email): Promise<void>; signInWithProvider("google" | "discord"): Promise<void>;
signOut(): Promise<void>; ensureGuestSession(): Promise<void>; // anonymous, idempotent
// api.ts — typed wrappers for every RPC in database-api.md
```

## UI events

- `SyncNotice` shows once per puzzle when `adopt-server` had `discardedLocal: true`
  (message key `sync.otherDeviceKept`).
- When signed in, `useGame` receives server-adopted sessions via a storage subscription
  (`useSyncExternalStore` on the daily key) so the board updates without reload.
- Share text gains a rarity line when available: `Rarity: 123` (no names).
