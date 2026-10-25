/**
 * Appends validated daily puzzles to data/schedule.json.
 * Usage: npm run schedule -- [--days 60] [--launch YYYY-MM-DD] [--reset]
 * --reset discards existing puzzles (only before launch!) and starts from --launch.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { dateForPuzzle, toIsoDate } from "../src/game/daily";
import { loadDataset, loadSchedule } from "../src/game/dataset";
import { generateGrid } from "../src/game/generator";
import { gridSignature } from "../src/game/grid";
import type { Schedule } from "../src/game/types";

const ROOT = path.resolve(import.meta.dirname, "..");
const dataPath = (file: string) => path.join(ROOT, "data", file);
const read = (file: string) => JSON.parse(readFileSync(dataPath(file), "utf8"));
const NO_REPEAT_WINDOW = 90;

const { values } = parseArgs({
  options: {
    days: { type: "string", default: "60" },
    launch: { type: "string", default: toIsoDate(Date.now()) },
    reset: { type: "boolean", default: false },
  },
});

const ds = loadDataset({
  characters: read("characters.json"),
  trainees: read("trainees.json"),
  categories: read("categories.json"),
});

const schedule: Schedule =
  existsSync(dataPath("schedule.json")) && !values.reset
    ? loadSchedule(read("schedule.json"))
    : { launchDate: values.launch!, puzzles: [] };

const days = Number(values.days);
const start = (schedule.puzzles.at(-1)?.puzzleNumber ?? 0) + 1;

for (let n = start; n < start + days; n++) {
  const recent = new Set(schedule.puzzles.slice(-(NO_REPEAT_WINDOW - 1)).map(gridSignature));
  const grid = generateGrid(ds, `daily-${n}`, { exclude: recent });
  if (!grid) throw new Error(`could not generate a valid grid for puzzle #${n}`);
  schedule.puzzles.push({
    puzzleNumber: n,
    date: dateForPuzzle(n, schedule.launchDate),
    rows: grid.rows,
    cols: grid.cols,
  });
}

writeFileSync(dataPath("schedule.json"), JSON.stringify(schedule, null, 2) + "\n");
console.log(
  `Scheduled puzzles #${start}–#${start + days - 1} (${schedule.puzzles.at(-1)?.date}); launch ${schedule.launchDate}.`,
);
