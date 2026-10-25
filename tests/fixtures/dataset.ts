import type { Grade } from "@/game/types";

type Raw = Record<string, unknown>;

const SRC = "https://example.org/source";

export function char(i: number, overrides: Raw = {}): Raw {
  return {
    id: `c${i}`,
    name: { en: `Char ${i}` },
    aliases: [],
    dorm: i <= 6 ? "ritto" : "miho",
    birthday: { month: ((i - 1) % 12) + 1, day: 1 },
    irl: {
      birthYear: 1990 + i,
      coat: i % 2 ? "bay" : "chestnut",
      maleLine: [i % 2 ? "sunday-silence" : "mr-prospector"],
      g1Wins: i <= 4 ? ["arima-kinen"] : i <= 8 ? ["japan-cup"] : ["tokyo-yushun"],
      g1WinCount: i % 5,
      titles: i === 1 ? ["triple-crown"] : [],
    },
    sources: { profile: SRC, irl: SRC },
    ...overrides,
  };
}

export function trainee(
  id: string,
  characterId: string,
  opts: { isOriginal?: boolean; dirt?: Grade; mile?: Grade; long?: Grade; front?: Grade } = {},
): Raw {
  return {
    id,
    characterId,
    versionTag: { en: opts.isOriginal === false ? "Summer" : "Original" },
    title: { en: `Title ${id}` },
    isOriginal: opts.isOriginal ?? true,
    servers: ["jp"],
    portrait: null,
    aptitudes: {
      track: { turf: "A", dirt: opts.dirt ?? "G" },
      distance: { sprint: "D", mile: opts.mile ?? "B", medium: "A", long: opts.long ?? "B" },
      style: { front: opts.front ?? "C", pace: "A", late: "B", end: "C" },
    },
    source: SRC,
  };
}

function cat(id: string, groupId: string, match: Raw, enabled = true): Raw {
  return { id, groupId, label: { en: id }, rule: { en: `Rule for ${id}` }, match, enabled };
}

export const GROUPS = ["track", "distance", "style", "dorm", "birthday", "g1", "sire", "profile"];

export function categoriesRaw(): Raw {
  return {
    groups: GROUPS.map((g) => ({ id: g, label: { en: g } })),
    categories: [
      cat("turf-a", "track", { type: "aptitude", axis: "track", key: "turf", min: "A" }),
      cat("dirt-a", "track", { type: "aptitude", axis: "track", key: "dirt", min: "A" }),
      cat("mile-a", "distance", { type: "aptitude", axis: "distance", key: "mile", min: "A" }),
      cat("medium-a", "distance", { type: "aptitude", axis: "distance", key: "medium", min: "A" }),
      cat("long-a", "distance", { type: "aptitude", axis: "distance", key: "long", min: "A" }),
      cat("pace-a", "style", { type: "aptitude", axis: "style", key: "pace", min: "A" }),
      cat("front-a", "style", { type: "aptitude", axis: "style", key: "front", min: "A" }),
      cat("dorm-ritto", "dorm", { type: "equals", field: "dorm", value: "ritto" }),
      cat("dorm-miho", "dorm", { type: "equals", field: "dorm", value: "miho" }),
      cat("season-winter", "birthday", { type: "birthMonth", months: [12, 1, 2] }),
      cat("season-spring", "birthday", { type: "birthMonth", months: [3, 4, 5] }),
      cat("season-summer", "birthday", { type: "birthMonth", months: [6, 7, 8] }),
      cat("season-autumn", "birthday", { type: "birthMonth", months: [9, 10, 11] }),
      cat("g1-arima-or-jc", "g1", {
        type: "includes",
        field: "irl.g1Wins",
        values: ["arima-kinen", "japan-cup"],
      }),
      cat("g1-count-3", "g1", { type: "atLeast", field: "irl.g1WinCount", value: 3 }),
      cat("sire-ss", "sire", { type: "includes", field: "irl.maleLine", values: ["sunday-silence"] }),
      cat("sire-mp", "sire", { type: "includes", field: "irl.maleLine", values: ["mr-prospector"] }),
      cat("decade-1990s", "profile", {
        type: "range",
        field: "irl.birthYear",
        min: 1990,
        max: 1999,
      }),
      cat("coat-bay", "profile", { type: "equals", field: "irl.coat", value: "bay" }),
      cat("disabled-cat", "profile", { type: "equals", field: "dorm", value: "ritto" }, false),
    ],
  };
}

/** 12 characters, one original trainee each, plus a summer version of c1. */
export function fixtureRaw() {
  const characters = Array.from({ length: 12 }, (_, k) => char(k + 1));
  const trainees = characters.map((c, k) => {
    const i = k + 1;
    return trainee(`t${i}`, c.id as string, {
      dirt: i % 3 === 0 ? "A" : "G",
      mile: i <= 6 ? "A" : "B",
      long: i > 6 ? "S" : "B",
      front: i % 2 ? "A" : "C",
    });
  });
  trainees.push(trainee("t1s", "c1", { isOriginal: false, dirt: "A" }));
  return {
    characters: { characters },
    trainees: { trainees },
    categories: categoriesRaw(),
  };
}
