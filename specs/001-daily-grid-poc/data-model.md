# Data Model: Umagrid Daily Grid (Frontend PoC)

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

File-level JSON shapes are in [contracts/dataset.md](contracts/dataset.md); persisted shapes in
[contracts/storage-and-share.md](contracts/storage-and-share.md).

## Shared types

- `LocalizedText`: `{ en: string; [locale: string]: string }` — `en` required.
- `Grade`: `"S" | "A" | "B" | "C" | "D" | "E" | "F" | "G"` (order S > A > … > G).
- `SourceRef`: URL string of the reference page used for a value.

**Source coverage (Constitution I / FR-025)**: every category-relevant field maps to exactly one
source reference — `name`, `aliases`, `dorm`, `birthday` → `Character.sources.profile`; all
`irl.*` fields → `Character.sources.irl`; `aptitudes.*`, `versionTag`, `title`, `servers` →
`TraineeVersion.source`.

## Character (static, `data/characters.json`)

Shared attributes of an Umamusume across all trainee versions.

| Field | Type | Rules |
|---|---|---|
| `id` | string (kebab-case) | Unique, stable |
| `name` | LocalizedText | Community romanization when no official EN name |
| `aliases` | string[] | Alternate spellings/romanizations/JP name for search |
| `dorm` | `"ritto" \| "miho"` | |
| `birthday` | `{ month: 1–12, day: 1–31 }` | Official profile birthday |
| `irl.birthYear` | integer | Real horse foaling year |
| `irl.coat` | enum (`bay`, `dark-bay`, `brown`, `chestnut`, `grey`, `black`, …) | |
| `irl.maleLine` | string[] | Notable male-line ancestors (kebab-case IDs) |
| `irl.g1Wins` | string[] | Race IDs (one entry per race, not per year) |
| `irl.g1WinCount` | integer ≥ 0 | Total G1/JpnI/overseas G1 wins, counting repeats |
| `irl.titles` | (`"triple-crown"` \| `"triple-tiara"`)[] | |
| `sources` | `{ profile: SourceRef; irl: SourceRef }` | Required (Constitution I) |

## TraineeVersion (static, `data/trainees.json`) — **the answer unit**

| Field | Type | Rules |
|---|---|---|
| `id` | string | Unique, stable (game card ID, e.g. `"109901"`) |
| `characterId` | string | Must reference an existing Character |
| `versionTag` | LocalizedText | Short tag, e.g. "Original", "Summer" |
| `title` | LocalizedText | Outfit title, e.g. "Starry Lightship" |
| `isOriginal` | boolean | Exactly one `true` per character |
| `servers` | (`"jp"` \| `"global"`)[] | Non-empty |
| `portrait` | string \| null | Path under `/portraits/` |
| `aptitudes.track` | `{ turf: Grade; dirt: Grade }` | |
| `aptitudes.distance` | `{ sprint; mile; medium; long: Grade }` | |
| `aptitudes.style` | `{ front; pace; late; end: Grade }` | |
| `source` | SourceRef | Required |

Display name: original → `name`; others → `name · versionTag` (e.g. "Special Week · Summer").

## CategoryGroup / Category (static, `data/categories.json`)

| Entity | Field | Rules |
|---|---|---|
| CategoryGroup | `id`, `label: LocalizedText` | 9 groups per FR-024 |
| Category | `id` | Unique |
| | `groupId` | References a group |
| | `label: LocalizedText` | Short header text, e.g. "Long ≥ A" |
| | `rule: LocalizedText` | Full player-visible membership rule (FR-022) |
| | `match: MatchRule` | See below |
| | `enabled: boolean` | Disabled categories are never generated |

`MatchRule` (discriminated union, evaluated against a TraineeVersion + its Character):

| `type` | Params | True when |
|---|---|---|
| `aptitude` | `axis: track\|distance\|style`, `key`, `min: Grade` | trainee's grade ≥ `min` |
| `equals` | `field: "dorm" \| "irl.coat"`, `value` | character field equals value |
| `birthMonth` | `months: number[]` | character birthday month in list (month or season) |
| `includes` | `field: "irl.g1Wins" \| "irl.maleLine" \| "irl.titles"`, `values: string[]` | array contains **any** of `values` |
| `atLeast` | `field: "irl.g1WinCount"`, `value` | number ≥ value |
| `range` | `field: "irl.birthYear"`, `min`, `max` | min ≤ value ≤ max |

Validation: every enabled category MUST match ≥ 3 trainee versions.

## Grid

| Field | Type | Rules |
|---|---|---|
| `rows`, `cols` | `[string, string, string]` | 6 distinct category IDs, ≥ 4 groups |
| `kind` | `"daily" \| "practice"` | |
| `puzzleNumber` | integer (daily) | ≥ 1 |
| `seed` | string (practice) | |

**ResolvedGrid** (derived at runtime): `answers[r][c]: TraineeVersionId[]` — must satisfy ≥ 3
answers from ≥ 2 characters per cell and a perfect matching between the 9 cells and 9
**distinct characters** (each cell matched to a character that has ≥ 1 valid trainee version in
it) — FR-013 / Constitution I.

## ScheduleEntry (static, `data/schedule.json`)

`{ puzzleNumber, date (YYYY-MM-DD, UTC), rows, cols }`; dates contiguous from `launchDate`;
signature (sorted IDs) unique within any 90-entry window.

## GameSession (persisted per daily puzzle; in memory for practice)

| Field | Type |
|---|---|
| `gridKey` | `"daily:<n>"` or `"practice:<seed>"` |
| `cells` | 9 × (`TraineeVersionId \| null`), row-major |
| `guesses` | `{ cell: 0–8, traineeId, correct: boolean, at: ISO }[]` |
| `status` | `"in_progress" \| "completed" \| "out_of_guesses" \| "gave_up"` |

Derived: `remaining = 9 − guesses.length`; `score = filled cells`; `used = set(cells)`.

**State transitions**

```text
in_progress --correct guess, all 9 filled--------> completed
in_progress --guess, remaining becomes 0---------> out_of_guesses
in_progress --give up (confirmed)----------------> gave_up
in_progress --guess otherwise--------------------> in_progress
(terminal states accept no further guesses)
```

Rejected submissions (cell already filled, trainee already used, game over) do not change state
and do not consume a guess (FR-007).

## HistoryEntry & PlayerStatistics

- `HistoryEntry` (persisted): `{ puzzleNumber, score, status }` — one per finished daily game.
- `PlayerStatistics` (derived): `played`, `averageScore`, `perfect` (score 9), `currentStreak`,
  `bestStreak` (streak = consecutive puzzle numbers finished, ending at the latest finished one,
  current only if latest ≥ today − 1).
