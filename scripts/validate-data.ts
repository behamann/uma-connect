/** Validates data/*.json (Constitution I). Exits non-zero on any problem. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { dateForPuzzle, puzzleNumberFor } from "../src/game/daily";
import { DataValidationError, loadDataset, loadSchedule } from "../src/game/dataset";
import { categoryMembers, checkGrid, gridSignature, MIN_ANSWERS_PER_CELL, resolveGrid } from "../src/game/grid";
import type { Grid } from "../src/game/types";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (file: string) => JSON.parse(readFileSync(path.join(ROOT, "data", file), "utf8"));

export const NO_REPEAT_WINDOW = 90;
const MIN_FUTURE_DAYS = 30;

function main() {
  const problems: string[] = [];
  const warnings: string[] = [];

  let ds;
  let schedule;
  try {
    ds = loadDataset({
      characters: read("characters.json"),
      trainees: read("trainees.json"),
      categories: read("categories.json"),
    });
    schedule = loadSchedule(read("schedule.json"));
  } catch (e) {
    if (e instanceof DataValidationError) {
      console.error(e.message);
      process.exit(1);
    }
    throw e;
  }

  for (const cat of ds.categories.values()) {
    const n = categoryMembers(ds, cat.id).size;
    if (cat.enabled && n < MIN_ANSWERS_PER_CELL) {
      problems.push(`category "${cat.id}" matches ${n} trainees (min ${MIN_ANSWERS_PER_CELL})`);
    }
  }

  const signatures: string[] = [];
  schedule.puzzles.forEach((entry, index) => {
    const label = `puzzle #${entry.puzzleNumber}`;
    if (entry.puzzleNumber !== index + 1) problems.push(`${label}: expected number ${index + 1}`);
    const expectedDate = dateForPuzzle(entry.puzzleNumber, schedule.launchDate);
    if (entry.date !== expectedDate) problems.push(`${label}: date ${entry.date} ≠ ${expectedDate}`);

    const grid: Grid = { rows: entry.rows, cols: entry.cols, kind: "daily", puzzleNumber: entry.puzzleNumber };
    const check = checkGrid(resolveGrid(grid, ds), ds);
    for (const p of check.problems) problems.push(`${label}: ${p}`);

    const sig = gridSignature(grid);
    if (signatures.slice(-(NO_REPEAT_WINDOW - 1)).includes(sig)) {
      problems.push(`${label}: repeats a grid from the previous ${NO_REPEAT_WINDOW} days`);
    }
    signatures.push(sig);
  });

  const today = puzzleNumberFor(new Date(), schedule.launchDate);
  const last = schedule.puzzles.at(-1)?.puzzleNumber ?? 0;
  if (last - today < MIN_FUTURE_DAYS) {
    const msg = `schedule covers ${Math.max(0, last - today)} future days (min ${MIN_FUTURE_DAYS}); run "npm run schedule"`;
    (process.env.CI ? problems : warnings).push(msg);
  }

  for (const w of warnings) console.warn(`warning: ${w}`);
  if (problems.length) {
    console.error(`Data validation failed:\n- ${problems.join("\n- ")}`);
    process.exit(1);
  }
  console.log(
    `Data OK: ${ds.characters.size} characters, ${ds.trainees.size} trainee versions, ` +
      `${[...ds.categories.values()].filter((c) => c.enabled).length} enabled categories, ` +
      `${schedule.puzzles.length} scheduled puzzles.`,
  );
}

main();
