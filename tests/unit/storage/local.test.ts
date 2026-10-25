import { describe, expect, it } from "vitest";
import {
  createStorage,
  pruneDailySessions,
  STORAGE_PREFIX,
  type KeyValueStore,
} from "@/storage/local";

function memory(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
    key: (i) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
  };
}

describe("storage adapter", () => {
  it("stores JSON under the versioned prefix", () => {
    const backing = memory();
    const s = createStorage(backing);
    s.set("settings", { howToPlaySeen: true });
    expect(backing.data.get(`${STORAGE_PREFIX}settings`)).toBe('{"howToPlaySeen":true}');
    expect(s.get("settings")).toEqual({ howToPlaySeen: true });
  });

  it("treats corrupt values as absent", () => {
    const backing = memory();
    backing.setItem(`${STORAGE_PREFIX}history`, "{not json");
    expect(createStorage(backing).get("history")).toBeUndefined();
  });

  it("falls back to memory when the backing store throws", () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {
        throw new Error("denied");
      },
      key: () => null,
      length: 0,
    };
    const s = createStorage(broken);
    s.set("daily:1", { a: 1 });
    expect(s.get("daily:1")).toEqual({ a: 1 });
  });

  it("prunes daily sessions older than 30 puzzles but keeps history", () => {
    const s = createStorage(memory());
    s.set("daily:1", {});
    s.set("daily:10", {});
    s.set("daily:35", {});
    s.set("history", []);
    pruneDailySessions(s, 40);
    expect(s.keys().sort()).toEqual(["daily:35", "history"]);
  });
});
