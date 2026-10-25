# Data Model: Player Accounts, Cloud Progress & Shared Stats

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | Schema: `public` (Postgres 17)

All tables: RLS **enabled**, **no** `SELECT/INSERT/UPDATE/DELETE` grants to `anon` or
`authenticated` (access only through RPC functions in
[contracts/database-api.md](contracts/database-api.md)). `auth.users` is managed by Supabase Auth.

## Reference data (written only by `scripts/backend/sync-puzzles.ts`)

### `trainees`
| Column | Type | Rules |
|---|---|---|
| `id` | text PK | Trainee version ID from `data/trainees.json` |
| `character_id` | text not null | |

### `puzzles`
| Column | Type | Rules |
|---|---|---|
| `puzzle_number` | int PK | \u2265 1 |
| `date` | date not null unique | UTC date (`dateForPuzzle`) |
| `rows`, `cols` | text[3] not null | category IDs |
| `data_version` | text not null | hash of dataset+schedule used to compute answers |

### `puzzle_answers`
| Column | Type | Rules |
|---|---|---|
| `puzzle_number` | int FK \u2192 puzzles | |
| `cell` | smallint | 0\u20138, row-major |
| `trainee_id` | text FK \u2192 trainees | |
| PK | (`puzzle_number`, `cell`, `trainee_id`) | equals engine `resolveGrid` output |

## Player data

### `profiles`
| Column | Type | Rules |
|---|---|---|
| `id` | uuid PK, FK \u2192 `auth.users(id)` on delete cascade | permanent users only |
| `display_name` | citext unique not null | 3\u201320 chars, `^[A-Za-z0-9 _.-]+$`, not in `reserved_names` |
| `leaderboard_opt_out` | boolean not null default false | FR-019 |
| `created_at` | timestamptz default now() | all-time tiebreak |

### `reserved_names`
`term citext PK` \u2014 blocklist (offensive/staff/brand terms); match = name contains term.

### `daily_sessions`
| Column | Type | Rules |
|---|---|---|
| `user_id` | uuid FK \u2192 `auth.users(id)` on delete cascade | permanent or anonymous |
| `puzzle_number` | int FK \u2192 puzzles | |
| `guesses` | jsonb not null default `[]` | array of `{cell:0-8, trainee_id, correct, at}`; length \u2264 9 |
| `status` | text | `in_progress \| completed \| out_of_guesses \| gave_up` |
| `score` | smallint | count of correct guesses (0\u20139), maintained by functions |
| `imported` | boolean default false | true when created by `import_local` |
| `is_guest` | boolean default false | created by `submit_guest_result` |
| `started_at`, `finished_at` | timestamptz | server times; `finished_at` set on final status |
| PK | (`user_id`, `puzzle_number`) | one session per player per puzzle |
| Index | (`puzzle_number`, `status`) | leaderboards/rarity |

**State transitions** (enforced in `apply_guess`, identical to `src/game/session.ts`):
```text
in_progress --correct guess filling 9th cell-----> completed
in_progress --9th guess, not all filled----------> out_of_guesses
in_progress --give_up()--------------------------> gave_up
final states: no further guesses (rejected)
```

### `legacy_history`
Imported local history entries without guess data (local sessions older than 30 days).
| Column | Type | Rules |
|---|---|---|
| `user_id` | uuid FK on delete cascade | |
| `puzzle_number` | int FK \u2192 puzzles | must be \u2264 today's puzzle |
| `score` | smallint 0\u20139 | |
| `status` | text final status | |
| PK | (`user_id`, `puzzle_number`) | ignored if a `daily_sessions` row exists |

Counts toward the player's own statistics only; never toward rarity or leaderboards.

## Aggregates (no user identity)

### `puzzle_stats`
`puzzle_number int PK`, `finished_games int not null default 0`.

### `answer_counts`
`puzzle_number`, `cell smallint`, `trainee_id text`, `picks int` \u2014 PK (puzzle, cell, trainee).
Incremented by trigger when a non-imported session becomes final (once per session).

### `leaderboard_totals` (materialized view, refreshed every 10 min)
| Column | Meaning |
|---|---|
| `period` | `week` \| `month` \| `all` |
| `period_key` | `2026-W44` \| `2026-10` \| `all` (from puzzle date, UTC) |
| `user_id`, `display_name` | permanent, non-opted-out users only |
| `score_sum`, `rarity_sum`, `games`, `perfect` | aggregates over final sessions in period |
| `created_at` | profile creation (all-time tiebreak) |
Unique index (`period`, `period_key`, `user_id`) for concurrent refresh.

## Relationships

```text
auth.users 1\u20141 profiles
auth.users 1\u2014* daily_sessions *\u20141 puzzles 1\u2014* puzzle_answers *\u20141 trainees
auth.users 1\u2014* legacy_history
puzzles 1\u20141 puzzle_stats; puzzles 1\u2014* answer_counts
```

## Client-side additions (localStorage, prefix `umagrid:v1:`)

| Key | Value |
|---|---|
| `outbox` | `{ puzzle, index, cell, traineeId, queuedAt }[]` pending guesses (signed-in only) |
| `sync:importedFor` | user id that local data was already imported into |
| `sync:notice` | pending "other device's game was kept" notice for a puzzle |
| `guestSubmitted:<n>` | puzzle numbers already submitted for rarity as a guest |
| (Supabase SDK) | its own auth session key |
