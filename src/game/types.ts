export type CharacterId = string;
export type TraineeId = string;
export type CategoryId = string;
export type GroupId = string;

export type LocalizedText = { en: string } & Record<string, string>;

export const GRADES = ["S", "A", "B", "C", "D", "E", "F", "G"] as const;
export type Grade = (typeof GRADES)[number];

export const DORMS = ["ritto", "miho"] as const;
export type Dorm = (typeof DORMS)[number];

export const SERVERS = ["jp", "global"] as const;
export type Server = (typeof SERVERS)[number];

export const COATS = [
  "bay",
  "dark-bay",
  "brown",
  "black",
  "chestnut",
  "liver-chestnut",
  "grey",
  "white",
] as const;
export type Coat = (typeof COATS)[number];

export const TITLES = ["triple-crown", "triple-tiara"] as const;
export type Title = (typeof TITLES)[number];

export interface Character {
  id: CharacterId;
  name: LocalizedText;
  aliases: string[];
  /** null = does not live in a dorm (e.g. "lives alone") */
  dorm: Dorm | null;
  birthday: { month: number; day: number };
  irl: {
    birthYear: number;
    coat: Coat;
    maleLine: string[];
    g1Wins: string[];
    g1WinCount: number;
    titles: Title[];
  };
  sources: { profile: string; irl: string };
}

export const APTITUDE_KEYS = {
  track: ["turf", "dirt"],
  distance: ["sprint", "mile", "medium", "long"],
  style: ["front", "pace", "late", "end"],
} as const;
export type AptitudeAxis = keyof typeof APTITUDE_KEYS;
export type AptitudeKey = (typeof APTITUDE_KEYS)[AptitudeAxis][number];

export interface Aptitudes {
  track: { turf: Grade; dirt: Grade };
  distance: { sprint: Grade; mile: Grade; medium: Grade; long: Grade };
  style: { front: Grade; pace: Grade; late: Grade; end: Grade };
}

export interface TraineeVersion {
  id: TraineeId;
  characterId: CharacterId;
  versionTag: LocalizedText;
  title: LocalizedText;
  isOriginal: boolean;
  servers: Server[];
  portrait: string | null;
  aptitudes: Aptitudes;
  source: string;
}

export type MatchRule =
  | { type: "aptitude"; axis: AptitudeAxis; key: AptitudeKey; min: Grade }
  | { type: "equals"; field: "dorm" | "irl.coat"; value: string }
  | { type: "birthMonth"; months: number[] }
  | { type: "includes"; field: "irl.g1Wins" | "irl.maleLine" | "irl.titles"; values: string[] }
  | { type: "atLeast"; field: "irl.g1WinCount"; value: number }
  | { type: "range"; field: "irl.birthYear"; min: number; max: number };

export interface CategoryGroup {
  id: GroupId;
  label: LocalizedText;
}

export interface Category {
  id: CategoryId;
  groupId: GroupId;
  label: LocalizedText;
  rule: LocalizedText;
  match: MatchRule;
  enabled: boolean;
}

export interface Dataset {
  characters: Map<CharacterId, Character>;
  trainees: Map<TraineeId, TraineeVersion>;
  groups: Map<GroupId, CategoryGroup>;
  categories: Map<CategoryId, Category>;
}

export type Triple<T> = [T, T, T];

export interface Grid {
  rows: Triple<CategoryId>;
  cols: Triple<CategoryId>;
  kind: "daily" | "practice";
  puzzleNumber?: number;
  seed?: string;
}

export interface ResolvedGrid {
  grid: Grid;
  /** answers[row][col] = valid trainee IDs for that cell */
  answers: Triple<Triple<TraineeId[]>>;
}

export interface GridCheck {
  ok: boolean;
  problems: string[];
}

export interface ScheduleEntry {
  puzzleNumber: number;
  date: string;
  rows: Triple<CategoryId>;
  cols: Triple<CategoryId>;
}

export interface Schedule {
  launchDate: string;
  puzzles: ScheduleEntry[];
}

export type SessionStatus = "in_progress" | "completed" | "out_of_guesses" | "gave_up";

export interface Guess {
  cell: number;
  traineeId: TraineeId;
  correct: boolean;
  at: string;
}

export interface GameSession {
  gridKey: string;
  /** 9 cells, row-major */
  cells: (TraineeId | null)[];
  guesses: Guess[];
  status: SessionStatus;
}

export interface HistoryEntry {
  puzzleNumber: number;
  score: number;
  status: Exclude<SessionStatus, "in_progress">;
}

export interface PlayerStatistics {
  played: number;
  averageScore: number;
  perfect: number;
  currentStreak: number;
  bestStreak: number;
}

export const MAX_GUESSES = 9;
export const CELL_COUNT = 9;
