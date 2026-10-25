/**
 * Top-level races counted as "G1" by Umagrid (JRA G1, NAR JpnI, overseas G1).
 * `since` = first year the race had G1/JpnI status; earlier wins are not counted.
 * Classic/major JRA races are counted for all years (pre-1984 "G1-equivalent" Hachidai Kyoso).
 */
export interface G1Race {
  id: string;
  names: string[];
  since?: number;
}

export const G1_RACES: G1Race[] = [
  // JRA
  { id: "february-stakes", names: ["February Stakes"], since: 1997 },
  { id: "takamatsunomiya-kinen", names: ["Takamatsunomiya Kinen", "Takamatsunomiya Hai"], since: 1996 },
  { id: "osaka-hai", names: ["Osaka Hai", "Sankei Osaka Hai"], since: 2017 },
  { id: "oka-sho", names: ["Oka Sho"] },
  { id: "satsuki-sho", names: ["Satsuki Sho"] },
  { id: "tenno-sho-spring", names: ["Tenno Sho (Spring)", "Spring Tenno Sho", "Tenno Sho Spring"] },
  { id: "nhk-mile-cup", names: ["NHK Mile Cup"], since: 1996 },
  { id: "victoria-mile", names: ["Victoria Mile"], since: 2006 },
  { id: "yushun-himba", names: ["Yushun Himba", "Japanese Oaks", "Yushun Himba (Japanese Oaks)"] },
  { id: "tokyo-yushun", names: ["Tokyo Yushun", "Japanese Derby", "Tokyo Yushun (Japanese Derby)"] },
  { id: "yasuda-kinen", names: ["Yasuda Kinen"], since: 1984 },
  { id: "takarazuka-kinen", names: ["Takarazuka Kinen"] },
  { id: "sprinters-stakes", names: ["Sprinters Stakes"], since: 1990 },
  { id: "shuka-sho", names: ["Shuka Sho"], since: 1996 },
  { id: "kikuka-sho", names: ["Kikuka Sho"] },
  { id: "tenno-sho-autumn", names: ["Tenno Sho (Autumn)", "Autumn Tenno Sho", "Tenno Sho Autumn"] },
  {
    id: "queen-elizabeth-ii-cup",
    names: ["Queen Elizabeth II Cup", "Queen Elizabeth II Commemorative Cup", "Queen Elizabeth II Kinen"],
    since: 1976,
  },
  { id: "mile-championship", names: ["Mile Championship"], since: 1984 },
  { id: "japan-cup", names: ["Japan Cup"] },
  { id: "champions-cup", names: ["Champions Cup", "Champion's Cup", "Japan Cup Dirt"], since: 2000 },
  {
    id: "hanshin-juvenile-fillies",
    names: ["Hanshin Juvenile Fillies", "Hanshin Sansai Himba Stakes", "Hanshin Sansai Stakes"],
    since: 1984,
  },
  {
    id: "asahi-hai-futurity-stakes",
    names: ["Asahi Hai Futurity Stakes", "Asahi Hai Sansai Stakes"],
    since: 1984,
  },
  { id: "hopeful-stakes", names: ["Hopeful Stakes"], since: 2017 },
  { id: "arima-kinen", names: ["Arima Kinen"] },
  // NAR JpnI
  { id: "teio-sho", names: ["Teio Sho"], since: 1995 },
  { id: "tokyo-daishoten", names: ["Tokyo Daishoten"], since: 1998 },
  { id: "kawasaki-kinen", names: ["Kawasaki Kinen"], since: 1995 },
  { id: "jbc-classic", names: ["JBC Classic"], since: 2001 },
  { id: "jbc-sprint", names: ["JBC Sprint"], since: 2001 },
  { id: "jbc-ladies-classic", names: ["JBC Ladies Classic"], since: 2011 },
  { id: "kashiwa-kinen", names: ["Kashiwa Kinen"], since: 2005 },
  {
    id: "mile-championship-nambu-hai",
    names: ["Mile Championship Nambu Hai", "Nambu Hai"],
    since: 1995,
  },
  { id: "japan-dirt-derby", names: ["Japan Dirt Derby", "Japan Dirt Classic"], since: 1999 },
  { id: "zen-nippon-nisai-yushun", names: ["Zen-Nippon Nisai Yushun", "Zen Nippon Nisai Yushun"], since: 2007 },
  { id: "sakitama-hai", names: ["Sakitama Hai"], since: 2024 },
  // Overseas G1
  { id: "american-oaks", names: ["American Oaks"] },
  { id: "queen-elizabeth-ii-cup-hk", names: ["Queen Elizabeth II Cup (Hong Kong)"] },
  { id: "dubai-world-cup", names: ["Dubai World Cup"] },
  { id: "dubai-turf", names: ["Dubai Turf", "Dubai Duty Free"] },
  { id: "dubai-sheema-classic", names: ["Dubai Sheema Classic"] },
  { id: "saudi-cup", names: ["Saudi Cup"] },
  { id: "hong-kong-cup", names: ["Hong Kong Cup"] },
  { id: "hong-kong-vase", names: ["Hong Kong Vase"] },
  { id: "hong-kong-mile", names: ["Hong Kong Mile"] },
  { id: "hong-kong-sprint", names: ["Hong Kong Sprint"] },
  { id: "grand-prix-de-saint-cloud", names: ["Grand Prix de Saint-Cloud"] },
  { id: "prix-jacques-le-marois", names: ["Prix Jacques Le Marois"] },
  { id: "prix-maurice-de-gheest", names: ["Prix Maurice de Gheest"] },
  { id: "cox-plate", names: ["Cox Plate", "W. S. Cox Plate"] },
  { id: "breeders-cup-distaff", names: ["Breeders' Cup Distaff"] },
  { id: "breeders-cup-filly-mare-turf", names: ["Breeders' Cup Filly & Mare Turf"] },
];

function normalizeRaceName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const RACE_INDEX = new Map<string, G1Race>();
for (const race of G1_RACES) {
  for (const name of race.names) RACE_INDEX.set(normalizeRaceName(name), race);
}

export function findG1Race(name: string): G1Race | undefined {
  return RACE_INDEX.get(normalizeRaceName(name));
}
