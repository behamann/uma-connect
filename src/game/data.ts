import charactersRaw from "../../data/characters.json" with { type: "json" };
import categoriesRaw from "../../data/categories.json" with { type: "json" };
import scheduleRaw from "../../data/schedule.json" with { type: "json" };
import traineesRaw from "../../data/trainees.json" with { type: "json" };
import { indexDataset, type DatasetFiles } from "./indexDataset";
import type { Schedule } from "./types";

// Validated at build time (prebuild → validate:data) and in tests/data; cast here to keep zod out of the bundle.
export const dataset = indexDataset({
  characters: charactersRaw,
  trainees: traineesRaw,
  categories: categoriesRaw,
} as unknown as DatasetFiles);

export const schedule = scheduleRaw as unknown as Schedule;
