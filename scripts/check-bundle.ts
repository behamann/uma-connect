/** Checks the static export against the PoC budget (JS + CSS + data ≤ 300 KB gzipped). Run after `npm run build`. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "out");
const BUDGET_KB = 300;

const gz = (file: string) => gzipSync(readFileSync(file)).length / 1024;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function initialAssets(page: string): string[] {
  const html = readFileSync(path.join(OUT, page), "utf8");
  const refs = [...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]!);
  return [...new Set(refs)].map((r) => path.join(OUT, r));
}

const all = walk(path.join(OUT, "_next/static")).filter((f) => /\.(js|css)$/.test(f));
const totalKb = all.reduce((sum, f) => sum + gz(f), 0);
const initial = initialAssets("index.html");
const initialKb = initial.reduce((sum, f) => sum + gz(f), 0);
// The game itself (and the bundled dataset) loads in a lazy client chunk; count the largest one too.
const largestLazy = all
  .filter((f) => !initial.includes(f))
  .map((f) => ({ f: path.basename(f), kb: gz(f) }))
  .sort((a, b) => b.kb - a.kb)
  .slice(0, 3);

const playableKb = initialKb + largestLazy.reduce((s, x) => s + x.kb, 0);
console.log(`initial JS+CSS (index): ${initialKb.toFixed(1)} KB gz`);
console.log(`largest lazy chunks: ${largestLazy.map((x) => `${x.f} ${x.kb.toFixed(1)} KB`).join(", ")}`);
console.log(`estimated to play: ${playableKb.toFixed(1)} KB gz (budget ${BUDGET_KB} KB)`);
console.log(`all static JS+CSS: ${totalKb.toFixed(1)} KB gz`);
if (playableKb > BUDGET_KB) {
  console.error("Over budget");
  process.exit(1);
}
