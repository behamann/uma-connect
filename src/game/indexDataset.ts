import type { Category, CategoryGroup, Character, Dataset, TraineeVersion } from "./types";

export interface DatasetFiles {
  characters: { characters: Character[] };
  trainees: { trainees: TraineeVersion[] };
  categories: { groups: CategoryGroup[]; categories: Category[] };
}

const byId = <T extends { id: string }>(items: T[]) => new Map(items.map((i) => [i.id, i]));

/**
 * Indexes already-validated data without loading the schema library, keeping it out of the
 * browser bundle. Data is validated at build time by `npm run validate:data` (prebuild).
 */
export function indexDataset(files: DatasetFiles): Dataset {
  return {
    characters: byId(files.characters.characters),
    trainees: byId(files.trainees.trainees),
    groups: byId(files.categories.groups),
    categories: byId(files.categories.categories),
  };
}
