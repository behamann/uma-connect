/**
 * Build-time data import (never runs in the app). Regenerates data/characters.json and
 * data/trainees.json from:
 *  - GameTora public data files: trainee cards, aptitudes, birthdays, dorms.
 *  - umamusu.wiki `IRL:` pages (CC BY-SA): real-horse coat, male line, major wins.
 * Usage: npm run import:data   (responses cached in data/.cache/)
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { findG1Race } from "./races";

const ROOT = path.resolve(import.meta.dirname, "../..");
const CACHE_DIR = path.join(ROOT, "data/.cache");
const SD_DIR = path.join(ROOT, "assets/images/sd");
const PORTRAIT_DIR = path.join(ROOT, "public/portraits");
const USER_AGENT = "uma-connect-data-import/0.1 (fan project)";
const GAMETORA = "https://gametora.com";
const WIKI = "https://umamusu.wiki";

/** Wiki page names that differ from GameTora's English name. */
const WIKI_NAME_OVERRIDES: Record<string, string> = {
  "TM Opera O": "T.M. Opera O",
};

type GtCharacter = {
  char_id: number;
  url_name: string;
  name_en: string;
  name_ja: string;
  playable: boolean;
  birth_day: number;
  birth_month: number;
  birth_year: number;
};
type GtProfile = { char_id: number; en?: { dorm?: string }; ja?: { dorm?: string } };
type GtCard = {
  card_id: number;
  char_id: number;
  url_name: string;
  title: string;
  title_en_gl?: string;
  title_jp?: string;
  release?: string;
  release_en?: string;
  aptitude: string[];
  version?: string;
};

/** GameTora's English labels for card `version` keys. */
const VERSION_LABELS: Record<string, string> = {
  alt: "Alt Version",
  summer: "Summer",
  anime_collab: "Anime Collab",
  fantasy: "Fantasy",
  fairytale: "Fairytale",
  wedding: "Wedding",
  full_armor: "Full Armor",
  halloween: "Halloween",
  fall_festival: "Festival",
  christmas: "Christmas",
  new_year: "New Year",
  valentine: "Valentine",
  ballroom: "Ballroom",
  cheerleader: "Cheerleader",
  camping: "Camping",
  commander: "Commander",
  grand_live: "Grand Concert",
  steampunk: "Steampunk",
  blaze: "BLAZE",
  sports_fest: "Sports Festival",
  summer_trip: "Summer Trip",
  warfare: "Warfare",
  autumn: "Autumn",
  larc: "Project L'Arc",
  uaf: "U.A.F.",
  gff: "Great Food Festival",
  mecha: "Mecha",
  twinkle: "The Twinkle Legends",
  island: "Deserted Island",
  parade: "Parade",
  onsen: "Onsen",
  beyond_dreams: "Beyond Dreams",
  tracen_ken: "Tracen-ken",
  five_point_five_anni: "5.5th Anni",
};

/** Asset file tags ("Name (Tag).png") that differ from GameTora labels. */
const ASSET_TAG_ALIASES: Record<string, string> = {
  christmass: "christmas",
  "anime-colab": "anime-collab",
  collab: "anime-collab",
  "l-arc": "project-l-arc",
  stage: "grand-concert",
};

/** Asset file names that differ from GameTora names, and per-character tag fixes. */
const ASSET_NAME_ALIASES: Record<string, string> = {
  "mr-cb": "mr-c-b",
  "yamanim-zephyr": "yamanin-zephyr",
};
const ASSET_CHARACTER_TAG_ALIASES: Record<string, Record<string, string>> = {
  "mejiro-dober": { summer: "camping" },
  "taiki-shuttle": { summer: "camping" },
};

async function cachedFetch(url: string, cacheName: string, asJson: boolean): Promise<unknown> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, cacheName);
  if (existsSync(file)) {
    const text = readFileSync(file, "utf8");
    return asJson ? JSON.parse(text) : text;
  }
  await new Promise((r) => setTimeout(r, 300));
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const text = await res.text();
  writeFileSync(file, text);
  return asJson ? JSON.parse(text) : text;
}

async function gametora<T>(manifest: Record<string, string>, key: string): Promise<T> {
  const url = `${GAMETORA}/data/umamusume/${key}.${manifest[key]}.json`;
  return (await cachedFetch(url, `gametora-${key}-${manifest[key]}.json`, true)) as T;
}

function kebab(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\((?:[a-z]{2,3})\)/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function infoboxField(wikitext: string, field: string): string | undefined {
  const m = wikitext.match(new RegExp(`^\\|\\s*${field}\\s*=(.*)$`, "mi"));
  const value = m?.[1]?.trim();
  return value ? value : undefined;
}

function stripWiki(s: string): string {
  return s
    .replace(/<ref[^>]*>.*?<\/ref>|<ref[^>]*\/>/gi, "")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/'''?/g, "")
    .trim();
}

const COAT_MAP: Record<string, string> = {
  bay: "bay",
  "dark bay": "dark-bay",
  "dark bay or brown": "dark-bay",
  brown: "brown",
  "dark brown": "brown",
  black: "black",
  "black bay": "dark-bay",
  chestnut: "chestnut",
  "liver chestnut": "liver-chestnut",
  "dark chestnut": "liver-chestnut",
  grey: "grey",
  gray: "grey",
  "white": "white",
};

const TRIPLE_CROWN = ["satsuki-sho", "tokyo-yushun", "kikuka-sho"];
const TRIPLE_TIARA = ["oka-sho", "yushun-himba", "shuka-sho"];
const TRIPLE_TIARA_PRE_1996 = ["oka-sho", "yushun-himba", "queen-elizabeth-ii-cup"];

interface WikiIrl {
  birthYear?: number;
  coat?: string;
  maleLine: string[];
  g1Wins: string[];
  g1WinCount: number;
  unknownRaces: string[];
}

function parseIrl(wikitext: string): WikiIrl {
  const dob = infoboxField(wikitext, "dob");
  const color = infoboxField(wikitext, "color")?.toLowerCase();
  const sireFields = ["sire", "grand sire", "3rd gen sire 1", "4th gen sire 1"];
  // Pedigree template repeats "sire"; take the infobox one first, then pedigree ancestors.
  const maleLine = sireFields
    .map((f) => infoboxField(wikitext, f))
    .filter((v): v is string => !!v)
    .map((v) => kebab(stripWiki(v)))
    .filter(Boolean);

  const wins = new Map<string, number>();
  const unknownRaces: string[] = [];
  const races = infoboxField(wikitext, "races") ?? "";
  for (const raw of races.split(/<br\s*\/?>|\n/i)) {
    const entry = stripWiki(raw);
    // Not anchored at the end: the last entry may carry template junk like "|float: right".
    const m = entry.match(/^(.*?)\s*\(([^()]*\d{4}[^()]*)\)/);
    if (!m) continue;
    const name = m[1]!.trim();
    const years = [...m[2]!.matchAll(/\d{4}/g)].map((y) => Number(y[0]));
    const race = findG1Race(name);
    if (!race) {
      unknownRaces.push(name);
      continue;
    }
    const counted = years.filter((y) => !race.since || y >= race.since).length;
    if (counted > 0) wins.set(race.id, (wins.get(race.id) ?? 0) + counted);
  }

  return {
    birthYear: dob ? Number(dob.slice(0, 4)) || undefined : undefined,
    coat: color ? COAT_MAP[stripWiki(color)] : undefined,
    maleLine: [...new Set(maleLine)],
    g1Wins: [...wins.keys()],
    g1WinCount: [...wins.values()].reduce((a, b) => a + b, 0),
    unknownRaces,
  };
}

function titleText(card: GtCard): string {
  const raw = card.title_en_gl || card.title || card.title_jp || String(card.card_id);
  return raw.replace(/^\[|\]$/g, "").trim();
}

/** Maps "Name.png" / "Name (Tag).png" assets to name → (tag | "") → file. */
function loadPortraitAssets(): Map<string, Map<string, string>> {
  const map = new Map<string, Map<string, string>>();
  if (!existsSync(SD_DIR)) return map;
  for (const file of readdirSync(SD_DIR)) {
    const m = file.match(/^([^()]+?)\s*(?:\(([^()]+)\))?\.png$/i);
    if (!m || file.startsWith("sd_")) continue;
    const name = ASSET_NAME_ALIASES[kebab(m[1]!)] ?? kebab(m[1]!);
    const rawTag = m[2] ? kebab(m[2]) : "";
    const tag = ASSET_CHARACTER_TAG_ALIASES[name]?.[rawTag] ?? ASSET_TAG_ALIASES[rawTag] ?? rawTag;
    if (!map.has(name)) map.set(name, new Map());
    map.get(name)!.set(tag, path.join(SD_DIR, file));
  }
  return map;
}

/** Exact tag match, else a unique prefix match (e.g. "Summer" → "Summer Trip" when no plain Summer card). */
function findPortrait(
  assets: Map<string, string> | undefined,
  label: string,
  siblingLabels: string[],
): string | undefined {
  if (!assets) return undefined;
  const want = kebab(label);
  const exact = assets.get(want);
  if (exact) return exact;
  if (!want) return undefined;
  for (const [tag, file] of assets) {
    if (!tag || !want.startsWith(tag)) continue;
    const competing = siblingLabels.some((l) => kebab(l) === tag);
    if (!competing) return file;
  }
  return undefined;
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const manifest = (await cachedFetch(
    `${GAMETORA}/data/manifests/umamusume.json`,
    `gametora-manifest-${today}.json`,
    true,
  )) as Record<string, string>;
  const chars = await gametora<GtCharacter[]>(manifest, "characters");
  const profiles = await gametora<GtProfile[]>(manifest, "character_profiles");
  const cards = await gametora<GtCard[]>(manifest, "character-cards");

  const released = cards.filter((c) => c.release && c.release <= today);
  const cardsByChar = new Map<number, GtCard[]>();
  for (const card of released) {
    cardsByChar.set(card.char_id, [...(cardsByChar.get(card.char_id) ?? []), card]);
  }

  const characters: unknown[] = [];
  const trainees: unknown[] = [];
  const report = { skipped: [] as string[], unknownRaces: new Map<string, string[]>() };
  const portraits = loadPortraitAssets();
  const unmatchedAssets = new Set(
    [...portraits.entries()].flatMap(([name, tags]) => [...tags.keys()].map((t) => `${name}|${t}`)),
  );
  mkdirSync(PORTRAIT_DIR, { recursive: true });

  for (const ch of chars.sort((a, b) => a.char_id - b.char_id)) {
    const charCards = cardsByChar.get(ch.char_id);
    if (!ch.playable || !charCards?.length) continue;

    const profile = profiles.find((p) => p.char_id === ch.char_id);
    const dormText = `${profile?.en?.dorm ?? ""} ${profile?.ja?.dorm ?? ""}`;
    const dorm = /ritto|栗東/i.test(dormText)
      ? "ritto"
      : /miho|美浦/i.test(dormText)
        ? "miho"
        : /lives alone|一人暮らし/i.test(dormText)
          ? null
          : undefined;

    const wikiName = (WIKI_NAME_OVERRIDES[ch.name_en] ?? ch.name_en).replace(/ /g, "_");
    const irlUrl = `${WIKI}/IRL:${wikiName}`;
    let irl: WikiIrl;
    try {
      const text = (await cachedFetch(
        `${irlUrl}?action=raw`,
        `wiki-irl-${kebab(ch.name_en)}.txt`,
        false,
      )) as string;
      irl = parseIrl(text);
    } catch (e) {
      report.skipped.push(`${ch.name_en}: IRL page unavailable (${(e as Error).message})`);
      continue;
    }
    if (irl.unknownRaces.length) report.unknownRaces.set(ch.name_en, irl.unknownRaces);

    const missing = [
      dorm === undefined && "dorm",
      !irl.coat && "coat",
      !irl.maleLine.length && "maleLine",
    ]
      .filter(Boolean)
      .join(", ");
    if (missing) {
      report.skipped.push(`${ch.name_en}: missing ${missing}`);
      continue;
    }

    // Before Shuka Sho existed (1996) the third Tiara leg was the Queen Elizabeth II Cup.
    const tiaraLegs = (irl.birthYear ?? ch.birth_year) < 1993 ? TRIPLE_TIARA_PRE_1996 : TRIPLE_TIARA;
    const titles = [
      TRIPLE_CROWN.every((r) => irl.g1Wins.includes(r)) && "triple-crown",
      tiaraLegs.every((r) => irl.g1Wins.includes(r)) && "triple-tiara",
    ].filter(Boolean);

    const id = kebab(ch.url_name);
    characters.push({
      id,
      name: { en: ch.name_en },
      aliases: [ch.name_ja],
      dorm,
      birthday: { month: ch.birth_month, day: ch.birth_day },
      irl: {
        birthYear: irl.birthYear ?? ch.birth_year,
        coat: irl.coat,
        maleLine: irl.maleLine,
        g1Wins: irl.g1Wins,
        g1WinCount: irl.g1WinCount,
        titles,
      },
      sources: {
        profile: `${GAMETORA}/umamusume/characters/${ch.url_name}`,
        irl: irlUrl,
      },
    });

    const versionLabel = (card: GtCard) =>
      card.card_id % 100 === 1
        ? ""
        : (VERSION_LABELS[card.version ?? ""] ?? titleText(card));
    const siblingLabels = charCards.map(versionLabel);

    for (const card of charCards.sort((a, b) => a.card_id - b.card_id)) {
      const [turf, dirt, sprint, mile, medium, long, front, pace, late, end] = card.aptitude;
      const isOriginal = card.card_id % 100 === 1;
      const title = titleText(card);
      const label = versionLabel(card);
      let portrait: string | null = null;
      const asset = findPortrait(portraits.get(kebab(ch.name_en)), label, siblingLabels);
      if (asset) {
        copyFileSync(asset, path.join(PORTRAIT_DIR, `${card.card_id}.png`));
        portrait = `/portraits/${card.card_id}.png`;
        for (const [tag, file] of portraits.get(kebab(ch.name_en)) ?? [])
          if (file === asset) unmatchedAssets.delete(`${kebab(ch.name_en)}|${tag}`);
      }
      trainees.push({
        id: String(card.card_id),
        characterId: id,
        versionTag: { en: isOriginal ? "Original" : label },
        title: { en: title },
        isOriginal,
        servers: card.release_en && card.release_en <= today ? ["jp", "global"] : ["jp"],
        portrait,
        aptitudes: {
          track: { turf, dirt },
          distance: { sprint, mile, medium, long },
          style: { front, pace, late, end },
        },
        source: `${GAMETORA}/umamusume/characters/${card.url_name}`,
      });
    }
  }

  writeFileSync(
    path.join(ROOT, "data/characters.json"),
    JSON.stringify({ characters }, null, 2) + "\n",
  );
  writeFileSync(path.join(ROOT, "data/trainees.json"), JSON.stringify({ trainees }, null, 2) + "\n");

  console.log(`characters: ${characters.length}, trainees: ${trainees.length}`);
  if (unmatchedAssets.size) {
    console.log(`\nPortrait assets not matched to a card:\n- ${[...unmatchedAssets].join("\n- ")}`);
  }
  if (report.skipped.length) console.log(`\nSkipped:\n- ${report.skipped.join("\n- ")}`);
  if (report.unknownRaces.size) {
    const all = new Map<string, number>();
    for (const list of report.unknownRaces.values())
      for (const r of list) all.set(r, (all.get(r) ?? 0) + 1);
    console.log(
      `\nUnrecognized races (not counted as G1):\n- ${[...all.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([r, n]) => `${r} (${n})`)
        .join("\n- ")}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
