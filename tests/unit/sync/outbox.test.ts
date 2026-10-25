import { describe, expect, it } from "vitest";
import { createStorage, type KeyValueStore } from "@/storage/local";
import { backoffDelay, createOutbox, type Op, type SendOutcome } from "@/sync/outbox";

function memory(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
    key: (i) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
  };
}

const guess = (puzzle: number, index: number) => ({ puzzle, index, cell: index, traineeId: `t${index}` });

function recorder(outcomes: Record<string, SendOutcome> = {}) {
  const sent: string[] = [];
  const send = async (op: Op) => {
    const id = `${op.puzzle}:${op.index}`;
    sent.push(id);
    return outcomes[id] ?? "ok";
  };
  return { sent, send };
}

describe("outbox", () => {
  it("sends ops in FIFO order and empties the queue", async () => {
    const outbox = createOutbox(createStorage(memory()));
    outbox.enqueue(guess(1, 0));
    outbox.enqueue(guess(1, 1));
    outbox.enqueue({ puzzle: 1, index: 2, giveUp: true });
    const r = recorder();
    expect(await outbox.flush(r.send)).toBe(true);
    expect(r.sent).toEqual(["1:0", "1:1", "1:2"]);
    expect(outbox.pending()).toEqual([]);
  });

  it("persists across reloads", () => {
    const backing = memory();
    createOutbox(createStorage(backing)).enqueue(guess(3, 0));
    expect(createOutbox(createStorage(backing)).pending()).toMatchObject([guess(3, 0)]);
  });

  it("stops on retry and keeps the op for later", async () => {
    const outbox = createOutbox(createStorage(memory()));
    outbox.enqueue(guess(1, 0));
    outbox.enqueue(guess(1, 1));
    const r = recorder({ "1:0": "retry" });
    expect(await outbox.flush(r.send)).toBe(false);
    expect(r.sent).toEqual(["1:0"]);
    expect(outbox.pending()).toHaveLength(2);
  });

  it.each(["conflict", "rejected"] as const)(
    "%s drops the puzzle's ops without blocking later puzzles",
    async (outcome) => {
      const outbox = createOutbox(createStorage(memory()));
      outbox.enqueue(guess(1, 0));
      outbox.enqueue(guess(1, 1));
      outbox.enqueue(guess(2, 0));
      const r = recorder({ "1:0": outcome });
      expect(await outbox.flush(r.send)).toBe(true);
      expect(r.sent).toEqual(["1:0", "2:0"]);
      expect(outbox.pending()).toEqual([]);
    },
  );

  it("drop removes only the given puzzle", () => {
    const outbox = createOutbox(createStorage(memory()));
    outbox.enqueue(guess(1, 0));
    outbox.enqueue(guess(2, 0));
    outbox.drop(1);
    expect(outbox.pending().map((o) => o.puzzle)).toEqual([2]);
    expect(outbox.pending(2)).toHaveLength(1);
  });

  it("picks up ops enqueued while flushing and shares a running flush", async () => {
    const outbox = createOutbox(createStorage(memory()));
    outbox.enqueue(guess(1, 0));
    const sent: number[] = [];
    const send = async (op: Op) => {
      sent.push(op.index);
      if (op.index === 0) outbox.enqueue(guess(1, 1));
      return "ok" as const;
    };
    const a = outbox.flush(send);
    const b = outbox.flush(send);
    expect(a).toBe(b);
    expect(await a).toBe(true);
    expect(sent).toEqual([0, 1]);
  });

  it("can flush again after flushing an empty queue", async () => {
    const outbox = createOutbox(createStorage(memory()));
    const r = recorder();
    expect(await outbox.flush(r.send)).toBe(true);
    outbox.enqueue(guess(1, 0));
    expect(await outbox.flush(r.send)).toBe(true);
    expect(r.sent).toEqual(["1:0"]);
  });

  it("backs off from 1 s to 60 s", () => {
    expect([0, 1, 2, 5, 6, 10].map(backoffDelay)).toEqual([1000, 2000, 4000, 32000, 60000, 60000]);
  });
});
