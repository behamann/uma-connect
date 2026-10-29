# Research: Player Accounts, Cloud Progress & Shared Stats

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-25

## R1. Backend shape with a static site

- **Decision**: Supabase hosted project (Postgres + Auth). The browser talks to it with
  `@supabase/supabase-js` using the **publishable key** (`sb_publishable_…`); all writes and
  reads go through Postgres RPC functions (`SECURITY DEFINER`, `search_path=''`). No Edge
  Functions, no custom server. The Next.js app stays `output: 'export'`.
- **Rationale**: Constitution II (static + managed backend). RPC-only access gives one audited
  entry point per operation, transactional validation, and simple RLS (tables are not exposed).
- **Alternatives**: Next.js server + Auth.js + Postgres (leaves static export, more ops); Edge
  Functions running the TS engine (Deno deploy, cold starts; see plan Complexity Tracking).
- **Keys**: legacy `anon`/`service_role` JWT keys are deprecated by end of 2026 \u2014 use
  publishable/secret keys from the start. The secret key is used only by
  `scripts/backend/sync-puzzles.ts` (developer machine or CI secret), never in the browser.
- **Environment separation (no dev/test traffic to production)**:
  - `.env.local` (git-ignored) holds ONLY the local stack values from `npx supabase status`;
    `next dev`, `next build` for E2E, and tests therefore always hit the local stack.
  - Production `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` exist only as
    GitHub repository variables used by the Pages deploy workflow.
  - The production secret key lives in `.env.production.secret` (git-ignored via `.env*`) and is
    loaded only by `sync-puzzles` (`node --env-file=.env.production.secret`, flag `--prod`), or
    as the `SUPABASE_SECRET_KEY` GitHub secret in CI. Never in `NEXT_PUBLIC_*`.

## R2. Authentication

- **Decision**: Supabase Auth with **PKCE** flow:
  - Email magic link: `signInWithOtp({ email, options: { emailRedirectTo: <site>/auth/callback } })`.
  - Google and Discord: **TODO (deferred)** — later via `signInWithOAuth({ provider, options: { redirectTo } })`.
  - `/auth/callback` is a client page calling `exchangeCodeForSession(code)`; works in a static
    export. PKCE requires opening the link in the same browser (matches spec AS-4).
  - Accounts with the same verified email across providers are linked automatically by Supabase
    (FR-003).
  - Session persisted by `supabase-js` in `localStorage`; sign-out clears it and the app wipes
    cached account data (FR-004).
- **Email sender (current decision)**: use Supabase's built-in development mailer for now. It is
  heavily rate-limited and intended for development (may only deliver to team members'
  addresses); configure custom SMTP before public launch.
- **Local dev**: `supabase start` runs Auth + Mailpit (http://localhost:54324) to read magic links;
  OAuth providers are configured only in the hosted project.

## R3. Guests contributing to rarity

- **Decision**: When a guest finishes a daily game (and the backend is enabled/online), the app
  lazily calls `signInAnonymously()` once per device and submits the full guess list with
  `submit_guest_result`. The anonymous session persists in `localStorage`, so each device counts
  once per puzzle (unique key on user + puzzle).
- **Abuse controls**: Supabase IP rate limit for anonymous sign-ins (default 30/hour, tunable);
  one result per anonymous user per puzzle; full server-side replay validation; daily `pg_cron`
  job deletes anonymous users older than 30 days (aggregates stay). Optional hardening:
  Cloudflare Turnstile CAPTCHA on anonymous sign-in (configurable; off for the first release to
  keep guests free of third-party scripts).
- **Not converting anonymous users**: when a guest later signs in, a normal sign-in replaces the
  anonymous session and local data is imported with `import_local` (simpler than identity
  linking, avoids existing-email conflicts). Imported sessions never add to rarity counts, so a
  guest game cannot be counted twice (accepted under-count: an imported in-progress game finished
  online later is not counted either).
- **Sign-out then guest play**: puzzles finished while signed in are added to the local
  `guestSubmitted` set, which survives sign-out, so the same device never re-submits that
  puzzle as a guest.
- **Alternatives**: Edge Function with IP-only identification (more code, weaker dedupe).

## R4. Server-side validation without re-implementing category rules

- **Decision**: `scripts/backend/sync-puzzles.ts` uses the existing engine (`dailyGrid` +
  `resolveGrid`) to upsert `puzzles`, `puzzle_answers (puzzle, cell, trainee_id)`, and
  `trainees`. SQL validation is then only: puzzle exists and `date <= current_date (UTC)`;
  trainee exists; cell 0\u20138 empty; trainee not used in the session; guess count < 9; session
  in progress; `correct = exists(puzzle_answers \u2026)`. Run on every schedule extension / dataset
  change (CI job + manual command).
- **Parity (Constitution IV)**: `tests/integration/parity.test.ts` (runs against the local stack)
  asserts DB answers equal engine answers for every scheduled puzzle and replays randomized guess
  sequences through both `session.ts` and `record_guess`, comparing outcomes and final state.

## R5. Sync protocol (first device wins)

- **Decision**: optimistic concurrency per guess. Each local guess is queued in a persisted
  outbox as `{ puzzle, index, cell, traineeId }` where `index` = number of guesses before it.
  `record_guess` accepts only if the server session currently has exactly `index` guesses and
  the earlier guesses match; otherwise it returns `conflict` + the server session.
  - Same device continuing: indices line up \u2192 accepted.
  - Device B after loading the account session: its indices continue the server's \u2192 accepted.
  - Offline device whose history diverged: `conflict` \u2192 client adopts the server session,
    clears that puzzle's outbox, shows the "other device's game was kept" notice (FR-012).
- **On load (signed in)**: fetch `get_my_daily(today)`. Pure `merge.ts` decides: no server
  session \u2192 push local (flush outbox / import); server is a prefix of local \u2192 flush local
  remainder; otherwise adopt server.
- **Retry**: exponential backoff (1 s \u2192 60 s), flush on `online`/`visibilitychange`; gameplay never
  awaits the network (FR-009).
- **Permanent rejections** (`puzzle_unavailable`, `unknown_trainee`, `bad_cell`, `game_over`,
  `cell_filled`, `trainee_used`, `permanent_account_required`): the op is dropped (never retried),
  the client re-fetches `get_my_daily` and adopts the server session, and the error is logged to
  the console; the outbox never blocks behind an invalid op.

## R6. Storage layout and free-tier sizing

- **Decision**: one row per (user, puzzle) in `daily_sessions` with `guesses jsonb` (array of
  `{cell, trainee_id, correct, at}`) instead of one row per guess.
- **Rationale**: 1,000 DAU \u00d7 365 days \u2248 365k rows/year \u00d7 ~400 B \u2248 150 MB/year, within the 500 MB
  free tier for well over a year; per-guess rows would be ~9\u00d7 the row count.
- **Free-tier note**: free projects pause after 1 week without activity \u2014 daily traffic prevents
  it; the site keeps working for guests if paused (Principle II).

## R7. Rarity aggregation

- **Decision**: trigger on `daily_sessions` when status becomes final and `imported = false`:
  increment `puzzle_stats.finished_games` and `answer_counts(puzzle, cell, trainee_id).picks` for
  each correct cell. `get_rarity(puzzle)` returns counts only when `finished_games >= 20`
  (FR-021). Pure `src/game/rarity.ts` computes per-cell % = picks / finished_games \u00d7 100 and the
  total score (empty/wrong cells = 100). Rarity is live (changes as more players finish).
- **Deletion**: aggregates have no user id, so deleting an account leaves them intact (spec).

## R8. Leaderboards

- **Daily**: computed on read by `get_leaderboard('daily', puzzle)`: final sessions (imported
  ones included) of permanent users with `leaderboard_opt_out = false`, joined with
  current rarity; order by score desc, rarity asc, `finished_at` asc; top 100 + caller rank.
  Index `(puzzle_number, status)`.
- **Weekly / monthly / all-time**: materialized view `leaderboard_totals` (per user and period
  key: ISO week `2026-W44`, month `2026-10`, `all`) with score sums, rarity sums, games, perfect
  count; `REFRESH MATERIALIZED VIEW CONCURRENTLY` every 10 minutes via `pg_cron`. UI shows
  "updated N min ago". `get_leaderboard` always inner-joins the MV with live `profiles` (display
  name and `leaderboard_opt_out` read live), so deleted or opted-out players disappear
  immediately rather than at the next refresh (FR-018, FR-019).
- **Rationale**: SC-007 (\u2264 2 s at 10k games) without per-request heavy aggregation.

## R9. Profiles, export, deletion

- **Profile**: created by trigger on `auth.users` insert for non-anonymous users (and on update
  when an account stops being anonymous), default name `Trainer-<6 digits>` (retry on clash).
  `display_name` is `citext` unique, 3\u201320 chars, `^[A-Za-z0-9 _.-]+$`, not in
  `reserved_names` (blocklist table seeded from a reviewed list).
- **Export**: `export_my_data()` returns JSON (profile, sessions, legacy history); the client
  downloads it as `uma-connect-export.json`.
- **Delete**: `delete_my_account()` (`SECURITY DEFINER`, owned by `postgres`) deletes
  `auth.users` row for `auth.uid()`; FKs cascade to profile/sessions/history; client signs out.
  Leaderboards stop showing the user immediately (live join with `profiles`, R8).
- **Backfill**: the profile migration also inserts profiles for permanent users created before
  it ran (accounts made while only US1/US2 existed).

## R10. Client loading strategy

- **Decision**: `src/backend/*` and `src/sync/*` are only reached via `import()`:
  on load if a Supabase session key exists in `localStorage`, when the player opens Sign in, or
  when a guest finishes a daily game. Build without `NEXT_PUBLIC_SUPABASE_URL` /
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` \u2192 `backendEnabled = false` and account UI hidden.
- **Rationale**: keeps current bundle/TTI for guests (PoC T077 concern) and Principle II.

## R11. Hosting on GitHub Pages

- **Decision**: deploy the static export to GitHub Pages with a GitHub Actions workflow
  (`actions/upload-pages-artifact` + `actions/deploy-pages`). Project sites live under a base
  path, so `next.config.ts` reads `NEXT_PUBLIC_BASE_PATH` (e.g. `/uma-connect`) for `basePath`, and
  sets `trailingSlash: true` so routes like `/auth/callback/` resolve to `index.html` files.
- **Asset URLs**: `next/link` handles `basePath`, but `unoptimized` images and data paths
  (`/portraits/...`) and the share URL must be prefixed manually with a small `withBasePath()`
  helper.
- **Auth URLs**: Supabase Site URL = `https://<user>.github.io/<repo>/`; redirect allowlist adds
  `https://<user>.github.io/<repo>/auth/callback/` (plus localhost entries for dev).
- **Build env**: production `NEXT_PUBLIC_SUPABASE_*` and `NEXT_PUBLIC_BASE_PATH` come from GitHub
  repository variables in the deploy workflow (never from `.env.local`).

## R12. Testing & CI

- `supabase start` needs Docker (Docker Desktop on Windows). CI uses `supabase/setup-cli` +
  `supabase start` on `ubuntu-latest`, then `supabase db lint`, `supabase test db` (pgTAP),
  Vitest parity, and Playwright account E2E with the local URL/keys from `supabase status`.
- Local `supabase/config.toml` raises `auth.rate_limit.email_sent` so magic-link E2E tests (several
  emails per run) are not throttled; the hosted project keeps its own limits.
- pgTAP helpers: `basejump-supabase_test_helpers` style `tests.create_supabase_user` /
  `authenticate_as` to test RLS as different users.

## Dependency justification (Constitution V)

| Dependency | Kind | Version | Why |
|---|---|---|---|
| @supabase/supabase-js | runtime (lazy) | 2.118.0 | Auth (PKCE, OAuth, OTP, anonymous) + RPC client |
| supabase (CLI) | dev | 2.122.0 | Local stack, migrations, pgTAP, type generation |
