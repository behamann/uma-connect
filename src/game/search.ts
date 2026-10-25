import { localize } from "./text";
import type { Dataset, TraineeId } from "./types";

export function normalize(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

interface Entry {
  id: TraineeId;
  name: string;
  nameWords: string[];
  aliases: string[];
  allWords: string[];
  compact: string[];
  sortName: string;
  isOriginal: boolean;
  sortVersion: string;
}

export interface SearchIndex {
  entries: Entry[];
}

const words = (s: string) => s.split(" ").filter(Boolean);

export function buildSearchIndex(ds: Dataset, locale: string): SearchIndex {
  const entries: Entry[] = [];
  for (const t of ds.trainees.values()) {
    const c = ds.characters.get(t.characterId);
    if (!c) continue;
    const name = normalize(localize(c.name, locale));
    const aliases = c.aliases.map(normalize).filter(Boolean);
    const version = t.isOriginal ? "" : normalize(localize(t.versionTag, locale));
    const nameWords = words(name);
    entries.push({
      id: t.id,
      name,
      nameWords,
      aliases,
      allWords: [...nameWords, ...aliases.flatMap(words), ...words(version)],
      compact: [name, ...aliases].map((s) => s.replace(/ /g, "")),
      sortName: name,
      isOriginal: t.isOriginal,
      sortVersion: version,
    });
  }
  return { entries };
}

function rank(entry: Entry, phrase: string, tokens: string[]): number | null {
  if (entry.name === phrase || entry.aliases.includes(phrase)) return 0;
  const prefixes = (pool: string[]) => tokens.every((t) => pool.some((w) => w.startsWith(t)));
  if (prefixes(entry.nameWords)) return 1;
  if (prefixes(entry.allWords)) return 2;
  const compactQuery = tokens.join("");
  if (entry.compact.some((s) => s.includes(compactQuery))) return 3;
  return null;
}

/** Matches by name/alias/version words; never considers cell validity (FR-004). */
export function search(index: SearchIndex, query: string, limit = 8): TraineeId[] {
  const phrase = normalize(query);
  const tokens = words(phrase);
  if (tokens.length === 0) return [];
  const hits: { entry: Entry; rank: number }[] = [];
  for (const entry of index.entries) {
    const r = rank(entry, phrase, tokens);
    if (r !== null) hits.push({ entry, rank: r });
  }
  hits.sort(
    (a, b) =>
      a.rank - b.rank ||
      a.entry.sortName.localeCompare(b.entry.sortName) ||
      Number(b.entry.isOriginal) - Number(a.entry.isOriginal) ||
      a.entry.sortVersion.localeCompare(b.entry.sortVersion),
  );
  return hits.slice(0, limit).map((h) => h.entry.id);
}
