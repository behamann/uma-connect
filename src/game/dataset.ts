import { z } from "zod";
import {
  APTITUDE_KEYS,
  COATS,
  DORMS,
  GRADES,
  SERVERS,
  TITLES,
  type Category,
  type CategoryGroup,
  type Character,
  type Dataset,
  type Schedule,
  type TraineeVersion,
} from "./types";

export class DataValidationError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid data:\n- ${problems.join("\n- ")}`);
    this.name = "DataValidationError";
  }
}

const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be kebab-case");
const localized = z.object({ en: z.string().min(1) }).catchall(z.string());
const grade = z.enum(GRADES);
const url = z.url();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");

const characterSchema = z.object({
  id,
  name: localized,
  aliases: z.array(z.string().min(1)),
  dorm: z.enum(DORMS).nullable(),
  birthday: z.object({
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
  }),
  irl: z.object({
    birthYear: z.number().int().min(1900).max(2100),
    coat: z.enum(COATS),
    maleLine: z.array(id),
    g1Wins: z.array(id),
    g1WinCount: z.number().int().min(0),
    titles: z.array(z.enum(TITLES)),
  }),
  sources: z.object({ profile: url, irl: url }),
});

const traineeSchema = z.object({
  id: z.string().min(1),
  characterId: id,
  versionTag: localized,
  title: localized,
  isOriginal: z.boolean(),
  servers: z.array(z.enum(SERVERS)).min(1),
  portrait: z.string().startsWith("/portraits/").nullable(),
  aptitudes: z.object({
    track: z.object({ turf: grade, dirt: grade }),
    distance: z.object({ sprint: grade, mile: grade, medium: grade, long: grade }),
    style: z.object({ front: grade, pace: grade, late: grade, end: grade }),
  }),
  source: url,
});

const allAptitudeKeys = [
  ...APTITUDE_KEYS.track,
  ...APTITUDE_KEYS.distance,
  ...APTITUDE_KEYS.style,
] as const;

const matchRuleSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("aptitude"),
    axis: z.enum(["track", "distance", "style"]),
    key: z.enum(allAptitudeKeys),
    min: grade,
  }),
  z.object({
    type: z.literal("equals"),
    field: z.enum(["dorm", "irl.coat"]),
    value: z.string().min(1),
  }),
  z.object({
    type: z.literal("birthMonth"),
    months: z.array(z.number().int().min(1).max(12)).min(1),
  }),
  z.object({
    type: z.literal("includes"),
    field: z.enum(["irl.g1Wins", "irl.maleLine", "irl.titles"]),
    values: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    type: z.literal("atLeast"),
    field: z.literal("irl.g1WinCount"),
    value: z.number().int().min(1),
  }),
  z.object({
    type: z.literal("range"),
    field: z.literal("irl.birthYear"),
    min: z.number().int(),
    max: z.number().int(),
  }),
]);

const categoriesFileSchema = z.object({
  groups: z.array(z.object({ id, label: localized })),
  categories: z.array(
    z.object({
      id,
      groupId: id,
      label: localized,
      rule: localized,
      match: matchRuleSchema,
      enabled: z.boolean(),
    }),
  ),
});

const charactersFileSchema = z.object({ characters: z.array(characterSchema) });
const traineesFileSchema = z.object({ trainees: z.array(traineeSchema) });

const triple = z.tuple([id, id, id]);
const scheduleSchema = z.object({
  launchDate: isoDate,
  puzzles: z.array(
    z.object({
      puzzleNumber: z.number().int().min(1),
      date: isoDate,
      rows: triple,
      cols: triple,
    }),
  ),
});

function zodProblems(file: string, error: z.ZodError): string[] {
  return error.issues.map((i) => `${file}: ${i.path.join(".") || "(root)"} ${i.message}`);
}

function indexUnique<T extends { id: string }>(
  items: T[],
  label: string,
  problems: string[],
): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    if (map.has(item.id)) problems.push(`${label}: duplicate id "${item.id}"`);
    map.set(item.id, item);
  }
  return map;
}

export function loadDataset(raw: {
  characters: unknown;
  trainees: unknown;
  categories: unknown;
}): Dataset {
  const problems: string[] = [];
  const chars = charactersFileSchema.safeParse(raw.characters);
  const trainees = traineesFileSchema.safeParse(raw.trainees);
  const cats = categoriesFileSchema.safeParse(raw.categories);
  if (!chars.success) problems.push(...zodProblems("characters", chars.error));
  if (!trainees.success) problems.push(...zodProblems("trainees", trainees.error));
  if (!cats.success) problems.push(...zodProblems("categories", cats.error));
  if (!chars.success || !trainees.success || !cats.success) throw new DataValidationError(problems);

  const characters = indexUnique<Character>(chars.data.characters, "characters", problems);
  const traineeMap = indexUnique<TraineeVersion>(trainees.data.trainees, "trainees", problems);
  const groups = indexUnique<CategoryGroup>(cats.data.groups, "groups", problems);
  const categories = indexUnique<Category>(cats.data.categories, "categories", problems);

  const originals = new Map<string, number>();
  for (const t of traineeMap.values()) {
    if (!characters.has(t.characterId)) {
      problems.push(`trainees: "${t.id}" references unknown character "${t.characterId}"`);
    }
    if (t.isOriginal) originals.set(t.characterId, (originals.get(t.characterId) ?? 0) + 1);
  }
  for (const c of characters.values()) {
    const count = originals.get(c.id) ?? 0;
    if (count !== 1) {
      problems.push(`characters: "${c.id}" must have exactly one original trainee (has ${count})`);
    }
  }
  for (const cat of categories.values()) {
    if (!groups.has(cat.groupId)) {
      problems.push(`categories: "${cat.id}" references unknown group "${cat.groupId}"`);
    }
    const m = cat.match;
    if (m.type === "aptitude" && !(APTITUDE_KEYS[m.axis] as readonly string[]).includes(m.key)) {
      problems.push(`categories: "${cat.id}" aptitude key "${m.key}" is not on axis "${m.axis}"`);
    }
    if (m.type === "range" && m.min > m.max) {
      problems.push(`categories: "${cat.id}" range min > max`);
    }
  }

  if (problems.length > 0) throw new DataValidationError(problems);
  return { characters, trainees: traineeMap, groups, categories };
}

export function loadSchedule(raw: unknown): Schedule {
  const parsed = scheduleSchema.safeParse(raw);
  if (!parsed.success) throw new DataValidationError(zodProblems("schedule", parsed.error));
  return parsed.data;
}
