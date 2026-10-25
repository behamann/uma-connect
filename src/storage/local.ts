/** Versioned localStorage adapter; falls back to memory when storage is unavailable. */
import type { HistoryEntry } from "@/game/types";

export const STORAGE_PREFIX = "umagrid:v1:";

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
  readonly length: number;
}

class MemoryStore implements KeyValueStore {
  private map = new Map<string, string>();
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  get length() {
    return this.map.size;
  }
}

function detectStore(): KeyValueStore {
  try {
    const s = globalThis.localStorage;
    const probe = `${STORAGE_PREFIX}__probe`;
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return new MemoryStore();
  }
}

export function createStorage(store: KeyValueStore = detectStore()) {
  const fallback = new MemoryStore();
  let active: KeyValueStore = store;
  const listeners = new Map<string, Set<() => void>>();
  const notify = (key: string) => listeners.get(key)?.forEach((l) => l());

  const run = <T>(fn: (s: KeyValueStore) => T): T => {
    try {
      return fn(active);
    } catch {
      active = fallback; // e.g. quota exceeded or storage revoked mid-session
      return fn(active);
    }
  };

  return {
    getRaw(key: string): string | null {
      return run((s) => s.getItem(STORAGE_PREFIX + key));
    },
    get<T>(key: string): T | undefined {
      const raw = run((s) => s.getItem(STORAGE_PREFIX + key));
      if (raw === null) return undefined;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return undefined;
      }
    },
    set(key: string, value: unknown): void {
      run((s) => s.setItem(STORAGE_PREFIX + key, JSON.stringify(value)));
      notify(key);
    },
    remove(key: string): void {
      run((s) => s.removeItem(STORAGE_PREFIX + key));
      notify(key);
    },
    /** Calls `listener` when `key` changes in this tab or (via the storage event) in another tab. */
    subscribe(key: string, listener: () => void): () => void {
      const set = listeners.get(key) ?? new Set();
      set.add(listener);
      listeners.set(key, set);
      const onStorage = (e: StorageEvent) => {
        if (e.key === STORAGE_PREFIX + key) listener();
      };
      globalThis.addEventListener?.("storage", onStorage);
      return () => {
        set.delete(listener);
        globalThis.removeEventListener?.("storage", onStorage);
      };
    },
    keys(): string[] {
      return run((s) => {
        const out: string[] = [];
        for (let i = 0; i < s.length; i++) {
          const k = s.key(i);
          if (k?.startsWith(STORAGE_PREFIX)) out.push(k.slice(STORAGE_PREFIX.length));
        }
        return out;
      });
    },
  };
}

export type Storage = ReturnType<typeof createStorage>;

let shared: Storage | undefined;
/** The app-wide storage instance, so writers (e.g. sync) and readers share change notifications. */
export function sharedStorage(): Storage {
  shared ??= createStorage();
  return shared;
}

export const DAILY_KEY = (puzzleNumber: number) => `daily:${puzzleNumber}`;
export const HISTORY_KEY = "history";
export const SETTINGS_KEY = "settings";
/** Puzzle number whose local game was replaced by another device's (FR-012). */
export const SYNC_NOTICE_KEY = "sync:notice";
/** Set once this device's result for a puzzle reached rarity stats (guest) or the account. */
export const GUEST_SUBMITTED_KEY = (puzzleNumber: number) => `guestSubmitted:${puzzleNumber}`;
export const KEEP_DAILY_SESSIONS = 30;

/** Removes daily sessions older than KEEP_DAILY_SESSIONS puzzles (history is kept). */
export function pruneDailySessions(storage: Storage, currentPuzzle: number): void {
  for (const key of storage.keys()) {
    const m = key.match(/^(?:daily|guestSubmitted):(\d+)$/);
    if (m && Number(m[1]) <= currentPuzzle - KEEP_DAILY_SESSIONS) storage.remove(key);
  }
}

export function readHistory(storage: Storage): HistoryEntry[] {
  const raw = storage.get<HistoryEntry[]>(HISTORY_KEY);
  return Array.isArray(raw) ? raw : [];
}

/** Adds or replaces the entry for a puzzle, keeping the list sorted by puzzle number. */
export function recordHistory(storage: Storage, entry: HistoryEntry): void {
  const others = readHistory(storage).filter((h) => h.puzzleNumber !== entry.puzzleNumber);
  storage.set(
    HISTORY_KEY,
    [...others, entry].sort((a, b) => a.puzzleNumber - b.puzzleNumber),
  );
}
