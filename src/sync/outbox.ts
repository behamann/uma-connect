/** Persisted FIFO of guesses waiting to reach the account (contracts/client-sync.md). */
import type { Storage } from "@/storage/local";

export type NewOp =
  | { puzzle: number; index: number; cell: number; traineeId: string }
  | { puzzle: number; index: number; giveUp: true };
export type Op = NewOp & { queuedAt: string };
export type SendOutcome = "ok" | "conflict" | "rejected" | "retry";

export const OUTBOX_KEY = "outbox";

/** Retry delay after `attempt` consecutive failures: 1 s, 2 s, 4 s … capped at 60 s. */
export function backoffDelay(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 60_000);
}

const sameOp = (a: Op, b: Op) => JSON.stringify(a) === JSON.stringify(b);

export function createOutbox(storage: Storage) {
  const read = (): Op[] => {
    const ops = storage.get<Op[]>(OUTBOX_KEY);
    return Array.isArray(ops) ? ops : [];
  };
  const write = (ops: Op[]) => (ops.length ? storage.set(OUTBOX_KEY, ops) : storage.remove(OUTBOX_KEY));

  const enqueue = (op: NewOp, now = new Date()) => write([...read(), { ...op, queuedAt: now.toISOString() }]);
  const pending = (puzzle?: number) => read().filter((o) => puzzle === undefined || o.puzzle === puzzle);
  const drop = (puzzle: number) => write(read().filter((o) => o.puzzle !== puzzle));

  let running: Promise<boolean> | null = null;

  /**
   * Sends ops in order. `conflict` and `rejected` drop the puzzle's remaining ops (the caller adopts
   * the server session), so an invalid op never blocks the queue. Resolves false when a send asks to
   * retry later, true when the queue is empty.
   */
  const flush = (send: (op: Op) => Promise<SendOutcome>): Promise<boolean> => {
    running ??= (async () => {
      for (;;) {
        const op = read()[0];
        if (!op) return true;
        const outcome = await send(op);
        if (outcome === "retry") return false;
        if (outcome === "ok") {
          const ops = read();
          const i = ops.findIndex((o) => sameOp(o, op));
          if (i >= 0) write([...ops.slice(0, i), ...ops.slice(i + 1)]);
        } else {
          drop(op.puzzle);
        }
      }
    })().finally(() => {
      // Runs asynchronously, i.e. after `running` holds this promise even when the queue was empty.
      running = null;
    });
    return running;
  };

  return { enqueue, pending, drop, flush };
}

export type Outbox = ReturnType<typeof createOutbox>;
