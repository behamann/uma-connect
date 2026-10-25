import { matches } from "./categories";
import type {
  CategoryId,
  CharacterId,
  Dataset,
  Grid,
  GridCheck,
  ResolvedGrid,
  TraineeId,
  Triple,
} from "./types";

export const MIN_ANSWERS_PER_CELL = 3;
export const MIN_CHARACTERS_PER_CELL = 2;
export const MIN_GROUPS_PER_GRID = 4;

const memberCache = new WeakMap<Dataset, Map<CategoryId, Set<TraineeId>>>();

/** Trainee IDs matching each category, computed once per dataset. */
export function categoryMembers(ds: Dataset, categoryId: CategoryId): Set<TraineeId> {
  let cache = memberCache.get(ds);
  if (!cache) {
    cache = new Map();
    memberCache.set(ds, cache);
  }
  let members = cache.get(categoryId);
  if (!members) {
    members = new Set();
    const category = ds.categories.get(categoryId);
    if (category) {
      for (const t of ds.trainees.values()) {
        const c = ds.characters.get(t.characterId);
        if (c && matches(category, t, c)) members.add(t.id);
      }
    }
    cache.set(categoryId, members);
  }
  return members;
}

export function cellAnswers(ds: Dataset, row: CategoryId, col: CategoryId): TraineeId[] {
  const a = categoryMembers(ds, row);
  const b = categoryMembers(ds, col);
  const result: TraineeId[] = [];
  for (const id of a) if (b.has(id)) result.push(id);
  return result;
}

export function resolveGrid(grid: Grid, ds: Dataset): ResolvedGrid {
  const answers = grid.rows.map((row) =>
    grid.cols.map((col) => cellAnswers(ds, row, col)),
  ) as Triple<Triple<TraineeId[]>>;
  return { grid, answers };
}

export function gridSignature(grid: Pick<Grid, "rows" | "cols">): string {
  return [...grid.rows, ...grid.cols].sort().join("|");
}

function charactersOf(ds: Dataset, trainees: TraineeId[]): Set<CharacterId> {
  const set = new Set<CharacterId>();
  for (const id of trainees) {
    const t = ds.trainees.get(id);
    if (t) set.add(t.characterId);
  }
  return set;
}

/** Kuhn's augmenting-path matching: can every cell get a different character? */
function hasPerfectCharacterMatching(cellCharacters: Set<CharacterId>[]): boolean {
  const owner = new Map<CharacterId, number>();
  const tryAssign = (cell: number, seen: Set<CharacterId>): boolean => {
    for (const ch of cellCharacters[cell] ?? []) {
      if (seen.has(ch)) continue;
      seen.add(ch);
      const current = owner.get(ch);
      if (current === undefined || tryAssign(current, seen)) {
        owner.set(ch, cell);
        return true;
      }
    }
    return false;
  };
  return cellCharacters.every((_, cell) => tryAssign(cell, new Set()));
}

export function checkGrid(resolved: ResolvedGrid, ds: Dataset): GridCheck {
  const problems: string[] = [];
  const { rows, cols } = resolved.grid;
  const ids = [...rows, ...cols];

  if (new Set(ids).size !== ids.length) problems.push("categories must be 6 distinct IDs");

  const groups = new Set<string>();
  for (const id of ids) {
    const cat = ds.categories.get(id);
    if (!cat) {
      problems.push(`unknown category "${id}"`);
      continue;
    }
    if (!cat.enabled) problems.push(`category "${id}" is disabled`);
    groups.add(cat.groupId);
  }
  if (groups.size < MIN_GROUPS_PER_GRID) {
    problems.push(`grid uses ${groups.size} groups (min ${MIN_GROUPS_PER_GRID})`);
  }

  const cellCharacters: Set<CharacterId>[] = [];
  resolved.answers.forEach((rowAnswers, r) =>
    rowAnswers.forEach((answers, c) => {
      const chars = charactersOf(ds, answers);
      cellCharacters.push(chars);
      const label = `${rows[r]} × ${cols[c]}`;
      if (answers.length < MIN_ANSWERS_PER_CELL) {
        problems.push(`${label}: ${answers.length} answers (min ${MIN_ANSWERS_PER_CELL})`);
      }
      if (chars.size < MIN_CHARACTERS_PER_CELL) {
        problems.push(`${label}: ${chars.size} characters (min ${MIN_CHARACTERS_PER_CELL})`);
      }
    }),
  );

  if (!hasPerfectCharacterMatching(cellCharacters)) {
    problems.push("grid cannot be solved with 9 different characters");
  }

  return { ok: problems.length === 0, problems };
}
