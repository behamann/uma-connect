# Contract: Dataset Files

Entity semantics: [data-model.md](../data-model.md). All files are UTF-8 JSON validated by Zod in
`src/game/dataset.ts` and by `npm run validate:data`.

## `data/characters.json`

```json
{
  "characters": [
    {
      "id": "hokko-tarumae",
      "name": { "en": "Hokko Tarumae" },
      "aliases": ["Hokkō Tarumae", "ホッコータルマエ", "Tarumae"],
      "dorm": "ritto",
      "birthday": { "month": 5, "day": 26 },
      "irl": {
        "birthYear": 2009,
        "coat": "bay",
        "maleLine": ["mr-prospector", "kingmambo", "king-kamehameha"],
        "g1Wins": ["teio-sho", "jbc-classic", "tokyo-daishoten", "kawasaki-kinen", "champions-cup", "kashiwa-kinen"],
        "g1WinCount": 10,
        "titles": []
      },
      "sources": {
        "profile": "https://umamusu.wiki/Hokko_Tarumae",
        "irl": "https://umamusu.wiki/IRL:Hokko_Tarumae"
      }
    }
  ]
}
```

## `data/trainees.json`

Aptitude values below are **illustrative**; real values are entered from the source page.

```json
{
  "trainees": [
    {
      "id": "109901",
      "characterId": "hokko-tarumae",
      "versionTag": { "en": "Original" },
      "title": { "en": "Starry Lightship" },
      "isOriginal": true,
      "servers": ["jp"],
      "portrait": "/portraits/109901.webp",
      "aptitudes": {
        "track": { "turf": "E", "dirt": "A" },
        "distance": { "sprint": "C", "mile": "A", "medium": "A", "long": "D" },
        "style": { "front": "B", "pace": "A", "late": "C", "end": "G" }
      },
      "source": "https://gametora.com/umamusume/characters/109901-hokko-tarumae"
    }
  ]
}
```

## `data/categories.json`

```json
{
  "groups": [
    { "id": "distance-aptitude", "label": { "en": "Distance aptitude" } }
  ],
  "categories": [
    {
      "id": "distance-long-a",
      "groupId": "distance-aptitude",
      "label": { "en": "Long ≥ A" },
      "rule": { "en": "This trainee version has Long distance aptitude A or S." },
      "match": { "type": "aptitude", "axis": "distance", "key": "long", "min": "A" },
      "enabled": true
    },
    {
      "id": "season-spring",
      "groupId": "birthday",
      "label": { "en": "Spring birthday" },
      "rule": { "en": "Official birthday in March, April, or May." },
      "match": { "type": "birthMonth", "months": [3, 4, 5] },
      "enabled": true
    },
    {
      "id": "classic-winner",
      "groupId": "titles",
      "label": { "en": "Classic winner" },
      "rule": { "en": "The real horse won at least one of: Satsuki Sho, Tokyo Yushun (Japanese Derby), Kikuka Sho, Oka Sho, Yushun Himba (Japanese Oaks), Shuka Sho." },
      "match": { "type": "includes", "field": "irl.g1Wins", "values": ["satsuki-sho", "tokyo-yushun", "kikuka-sho", "oka-sho", "yushun-himba", "shuka-sho"] },
      "enabled": true
    }
  ]
}
```

## `data/schedule.json`

```json
{
  "launchDate": "2026-11-01",
  "puzzles": [
    {
      "puzzleNumber": 1,
      "date": "2026-11-01",
      "rows": ["dorm-ritto", "distance-long-a", "g1-arima-kinen"],
      "cols": ["track-turf-a", "season-spring", "sire-sunday-silence"]
    }
  ]
}
```

## Validation rules (`npm run validate:data`, fails CI)

1. Schema valid; IDs unique per file; all references resolve.
2. Exactly one `isOriginal: true` trainee per character; every character has ≥ 1 trainee.
3. Every `LocalizedText` has `en`.
4. Every enabled category matches ≥ 3 trainee versions.
5. Every schedule entry: dates contiguous from `launchDate`, all categories enabled, grid passes
   FR-013 (≥ 3 answers from ≥ 2 characters per cell + perfect matching of cells to 9 distinct
   characters), ≥ 4 groups, signature
   unique within 90 entries.
6. Schedule covers ≥ 30 days beyond the current date.
