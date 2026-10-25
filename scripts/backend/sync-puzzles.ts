/**
 * Publishes reference data to Supabase: trainees, scheduled puzzles and their answers computed by
 * the TypeScript engine (research R4). Usage:
 *   npm run backend:sync-puzzles            # local stack (default)
 *   npm run backend:sync-puzzles:prod       # SUPABASE_URL/SUPABASE_SECRET_KEY from .env.production.secret
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { dailyGrid } from "../../src/game/daily";
import { loadDataset, loadSchedule } from "../../src/game/dataset";
import { resolveGrid } from "../../src/game/grid";
import { isLocalUrl, localStack } from "./local-stack";

const ROOT = path.resolve(import.meta.dirname, "../..");
const CHUNK = 1000;
const readRaw = (file: string) => readFileSync(path.join(ROOT, "data", file), "utf8");

function target(): { url: string; secretKey: string; label: string } {
  if (process.argv.includes("--prod")) {
    const url = process.env.SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY;
    if (!url || !secretKey) {
      throw new Error("--prod needs SUPABASE_URL and SUPABASE_SECRET_KEY (use npm run backend:sync-puzzles:prod)");
    }
    if (isLocalUrl(url)) throw new Error("--prod refuses to run against a local URL");
    return { url, secretKey, label: new URL(url).host };
  }
  const stack = localStack();
  if (!stack) throw new Error("Local Supabase stack is not running (npm run db:start)");
  if (!isLocalUrl(stack.url)) throw new Error(`--local expected a local URL, got ${stack.url}`);
  return { url: stack.url, secretKey: stack.secretKey, label: "local stack" };
}

function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK) out.push(items.slice(i, i + CHUNK));
  return out;
}

async function main() {
  const files = ["characters.json", "trainees.json", "categories.json"].map(readRaw);
  const ds = loadDataset({
    characters: JSON.parse(files[0]!),
    trainees: JSON.parse(files[1]!),
    categories: JSON.parse(files[2]!),
  });
  const schedule = loadSchedule(JSON.parse(readRaw("schedule.json")));
  const datasetHash = createHash("sha256").update(files.join("\n")).digest("hex");

  const { url, secretKey, label } = target();
  const db = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const check = <T extends { error: { message: string } | null }>(res: T, what: string): T => {
    if (res.error) throw new Error(`${what}: ${res.error.message}`);
    return res;
  };

  const trainees = [...ds.trainees.values()].map((t) => ({ id: t.id, character_id: t.characterId }));
  for (const part of chunks(trainees)) {
    check(await db.from("trainees").upsert(part), "upsert trainees");
  }

  const { data: existing } = check(
    await db.from("puzzles").select("puzzle_number, data_version"),
    "read puzzles",
  );
  const current = new Map((existing ?? []).map((p) => [p.puzzle_number as number, p.data_version as string]));

  const stale = schedule.puzzles
    .map((entry) => ({
      entry,
      version: createHash("sha256").update(datasetHash).update(JSON.stringify(entry)).digest("hex").slice(0, 16),
    }))
    .filter(({ entry, version }) => current.get(entry.puzzleNumber) !== version);

  if (stale.length) {
    const numbers = stale.map((s) => s.entry.puzzleNumber);
    check(
      await db.from("puzzles").upsert(
        stale.map(({ entry }) => ({
          puzzle_number: entry.puzzleNumber,
          date: entry.date,
          rows: entry.rows,
          cols: entry.cols,
          data_version: "pending",
        })),
      ),
      "upsert puzzles",
    );
    for (const part of chunks(numbers)) {
      check(await db.from("puzzle_answers").delete().in("puzzle_number", part), "delete answers");
    }

    const answers = stale.flatMap(({ entry }) => {
      const grid = dailyGrid(schedule, entry.puzzleNumber)!;
      const resolved = resolveGrid(grid, ds);
      return resolved.answers.flatMap((row, r) =>
        row.flatMap((ids, c) =>
          ids.map((traineeId) => ({ puzzle_number: entry.puzzleNumber, cell: r * 3 + c, trainee_id: traineeId })),
        ),
      );
    });
    for (const part of chunks(answers)) {
      check(await db.from("puzzle_answers").insert(part), "insert answers");
    }

    for (const { entry, version } of stale) {
      check(
        await db.from("puzzles").update({ data_version: version }).eq("puzzle_number", entry.puzzleNumber),
        "update data_version",
      );
    }
  }

  const unscheduled = [...current.keys()].filter((n) => !schedule.puzzles.some((p) => p.puzzleNumber === n));
  if (unscheduled.length) console.warn(`warning: puzzles in the database but not in the schedule: ${unscheduled.join(", ")}`);

  console.log(
    `Synced to ${label}: ${trainees.length} trainees, ${schedule.puzzles.length} puzzles ` +
      `(${stale.length} updated).`,
  );
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
