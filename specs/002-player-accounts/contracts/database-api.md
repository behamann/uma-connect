# Contract: Database API (Postgres RPC via `supabase.rpc`)

All functions: `SECURITY DEFINER`, `SET search_path = ''`, fully qualified names, `EXECUTE`
granted only as listed. Errors are raised with `SQLSTATE 'P0001'` and a stable `MESSAGE` code.
Callers are identified only by `auth.uid()`; no function accepts a user id parameter.

## Gameplay (role `authenticated`, permanent users unless noted)

### `record_guess(p_puzzle int, p_index int, p_cell int, p_trainee text) \u2192 jsonb`
Appends one guess. `p_index` = number of guesses the client had before this one.
- Creates the session on first guess.
- Rejects: `puzzle_unavailable` (unknown or `date > (now() at time zone 'utc')::date`), `unknown_trainee`,
  `bad_cell`, `game_over`, `cell_filled`, `trainee_used`.
- If server guess count \u2260 `p_index` \u2192 returns `{ "result": "conflict", "session": <session> }`.
- Success \u2192 `{ "result": "correct" | "incorrect", "session": <session> }`.

### `give_up(p_puzzle int, p_index int) \u2192 jsonb`
Same concurrency rule; sets `gave_up`. Returns `{ result: "ok" | "conflict", session }`.

### `get_my_daily(p_puzzle int) \u2192 jsonb | null`
`<session>` = `{ puzzle_number, guesses:[{cell,trainee_id,correct,at}], status, score }`.

### `get_my_history() \u2192 jsonb`
`[{ puzzle_number, score, status, source: "session" | "legacy" }]` sorted by puzzle.

### `import_local(p_sessions jsonb, p_history jsonb) \u2192 jsonb`
- `p_sessions`: `[{ puzzle_number, guesses:[{cell, trainee_id}], gave_up: bool }]` \u2014 each replayed
  through the same validation; skipped if a server session exists for that puzzle (first device
  wins). Imported rows have `imported = true` (no rarity counting).
- `p_history`: `[{ puzzle_number, score, status }]` stored in `legacy_history` only when no
  session row exists; score clamped 0\u20139, status must be final.
- Returns `{ imported_sessions, skipped_sessions, imported_history }`. Max 400 items per call.

### `submit_guest_result(p_puzzle int, p_guesses jsonb, p_gave_up bool) \u2192 jsonb`
Anonymous users only (`auth.jwt()->>'is_anonymous' = 'true'`); full replay validation; game must
end in a final state; one per anonymous user per puzzle (`already_submitted`). Counts toward
rarity. Returns `{ result: "ok" }`.

## Shared stats (roles `anon` and `authenticated`)

### `get_rarity(p_puzzle int) \u2192 jsonb`
`{ finished_games, threshold: 20, cells: [{ cell, trainee_id, picks }] | null }` \u2014 `cells` is
`null` while `finished_games < 20`. Only for puzzles with `date <= current_date`.

### `get_leaderboard(p_period text, p_key text) \u2192 jsonb`
- `p_period`: `daily` (key = puzzle number), `week` (`YYYY-Www`), `month` (`YYYY-MM`), `all`.
- Returns `{ updated_at, entries: [{ rank, display_name, score, rarity, games?, perfect? }],
  me: { rank, \u2026 } | null }` \u2014 top 100; `me` only for the authenticated caller. Never returns
  user ids or emails. Period results come from the materialized view joined live with
  `profiles`, so deleted/opted-out players never appear even before the next refresh.

## Account (role `authenticated`, permanent users)

### `get_my_profile() \u2192 jsonb`
`{ display_name, leaderboard_opt_out, created_at, email }` (sign-in providers list deferred with
Google/Discord).

### `update_profile(p_display_name text default null, p_opt_out bool default null) \u2192 jsonb`
Errors: `name_length`, `name_chars`, `name_reserved`, `name_taken`. Returns profile.

### `export_my_data() \u2192 jsonb`
`{ exported_at, profile, sessions:[\u2026], legacy_history:[\u2026] }`.

### `delete_my_account() \u2192 void`
Deletes `auth.users` row for the caller (cascades). Irreversible.

## Grants summary

| Function | anon | authenticated |
|---|---|---|
| record_guess, give_up, get_my_daily, get_my_history, import_local | \u2013 | \u2713 (permanent) |
| submit_guest_result | \u2013 | \u2713 (anonymous only) |
| get_rarity, get_leaderboard | \u2713 | \u2713 |
| get_my_profile, update_profile, export_my_data, delete_my_account | \u2013 | \u2713 (permanent) |

Functions reject anonymous callers where "permanent" is required with `permanent_account_required`.
