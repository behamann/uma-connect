---

description: "Task list for Player Accounts, Cloud Progress & Shared Stats"
---

# Tasks: Player Accounts, Cloud Progress & Shared Stats

**Input**: Design documents from `/specs/002-player-accounts/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included. Constitution IV (parity) and VI (RLS isolation, deletion) require automated
tests; pgTAP for the database, Vitest for pure client logic, Playwright against the local stack.

**Scope note**: Sign-in is **email magic link only**. Google/Discord sign-in (FR-002/FR-003) and
custom SMTP are deferred TODOs and have no tasks here; the built-in Supabase mailer is used.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story from spec.md (US1–US5)

---

## Phase 1: Setup

- [X] T001 Add dev dependency `supabase` (CLI) and run `npx supabase init` to create `supabase/config.toml`; set `site_url = "http://localhost:3000"`, `additional_redirect_urls = ["http://localhost:3000/auth/callback", "http://localhost:3100/auth/callback"]`, email OTP enabled, `enable_anonymous_sign_ins = true`, `[auth.rate_limit] email_sent` raised (e.g. 100/hour, local only) so magic-link E2E runs are not throttled, external Google/Discord disabled with a `# TODO: enable Google/Discord (FR-002)` comment
- [X] T002 Add runtime dependency `@supabase/supabase-js` and npm scripts in `package.json`: `db:start`, `db:stop`, `db:reset`, `db:test` (`supabase test db`), `db:lint`, `db:types` (`supabase gen types typescript --local > src/backend/database.types.ts`), `backend:sync-puzzles` (`tsx scripts/backend/sync-puzzles.ts`)
- [X] T003 [P] Create `.env.example` documenting the split: `.env.local` = local stack only (`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), `.env.production.secret` = `SUPABASE_URL` + `SUPABASE_SECRET_KEY` for `sync-puzzles --prod` only; production `NEXT_PUBLIC_*` live only in GitHub repository variables. Update `.gitignore` to keep ignoring `.env*` but allow `!.env.example`
- [X] T004 [P] Add `supabase` job to `.github/workflows/ci.yml`: `supabase/setup-cli`, `supabase start`, `supabase db lint`, `supabase test db`, `npm run backend:sync-puzzles -- --local`, parity test, account E2E with local URL/keys from `supabase status -o env`; keep existing job as the guest-only build (no Supabase env)
- [X] T005 [P] Record the installed versions of `@supabase/supabase-js` and the `supabase` CLI in the dependency table of `specs/002-player-accounts/research.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Database core

- [X] T006 Create migration `supabase/migrations/<ts>_core_schema.sql` with tables `trainees`, `puzzles`, `puzzle_answers`, `profiles`, `reserved_names`, `daily_sessions`, `legacy_history`, `puzzle_stats`, `answer_counts` exactly as in data-model.md (`profiles.display_name` citext unique; `daily_sessions` PK (`user_id`,`puzzle_number`), `guesses jsonb` "length ≤ 9", `status` check in `in_progress|completed|out_of_guesses|gave_up`, `score` 0–9, FKs to `auth.users(id) on delete cascade`, index (`puzzle_number`,`status`))
- [X] T007 Create migration `supabase/migrations/<ts>_rls_and_grants.sql`: enable RLS on every table, `revoke all on all tables in schema public from anon, authenticated`, alter default privileges so new tables/functions are not granted to `anon`/`authenticated`
- [X] T008 [P] Add pgTAP helpers (create test users, authenticate as user/anon) in `supabase/tests/000-helpers.sql` and `supabase/tests/rls.test.sql` proving `anon` and `authenticated` cannot select/insert/update/delete any table directly
- [X] T009 Implement `scripts/backend/sync-puzzles.ts`: use `dataset`/`schedule` + `dailyGrid`/`resolveGrid` to upsert `trainees`, `puzzles` (with `data_version` = hash of data files), and replace `puzzle_answers` per puzzle; `--local` reads URL/secret key from `npx supabase status -o env`; `--prod` requires being started with `node --env-file=.env.production.secret` (or CI secrets) and refuses to run if the URL is localhost; default (no flag) is `--local`; never logs the key
- [X] T010 Create migration `supabase/migrations/<ts>_game_functions.sql`: internal `apply_guess(user, puzzle, cell, trainee)` (rejections `puzzle_unavailable` for unknown or `date > (now() at time zone 'utc')::date`, `unknown_trainee`, `bad_cell`, `game_over`, `cell_filled`, `trainee_used`; correctness from `puzzle_answers`; status transitions per data-model), and RPCs `record_guess(p_puzzle, p_index, p_cell, p_trainee)`, `give_up(p_puzzle, p_index)`, `get_my_daily(p_puzzle)` per contracts/database-api.md (index mismatch → `conflict` + session; anonymous callers → `permanent_account_required`; `SECURITY DEFINER`, `search_path = ''`; grant execute to `authenticated` only)
- [X] T011 [P] pgTAP `supabase/tests/guesses.test.sql`: every rejection code, conflict on index mismatch, transitions to `completed`/`out_of_guesses`/`gave_up`, score maintenance, future puzzle rejected, anonymous caller rejected
- [ ] T012 [P] Vitest `tests/integration/parity.test.ts` (skipped unless `SUPABASE_URL` env points to the local stack): DB `puzzle_answers` equal engine `resolveGrid` for every scheduled puzzle; 200 seeded random guess sequences produce identical outcomes/final state via `session.ts` and `record_guess`; the same sequences (with and without give-up) replayed through `give_up`, `import_local`, and `submit_guest_result` yield the same final status/score as the engine; add `vitest.config.ts` include for `tests/integration/**`

### Client foundation

- [X] T013 [P] Create `src/backend/config.ts` (`backendEnabled` when both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are set) and `src/backend/client.ts` (singleton `createClient` with `flowType: "pkce"`, `persistSession: true`, `detectSessionInUrl: false`); generate `src/backend/database.types.ts` with `npm run db:types`
- [X] T014 [P] Implement `src/backend/load.ts`: `loadBackend()` = cached `import()` of `src/backend/*` + `src/sync/*`; `hasStoredSession()` checks the Supabase auth key in `localStorage` without loading the SDK
- [X] T015 Implement typed RPC wrappers in `src/backend/api.ts` for `record_guess`, `give_up`, `get_my_daily` (others added per story), mapping SQL error codes to a `BackendError` union
- [X] T016 Refactor `src/hooks/useGame.ts` so the daily session is read through `useSyncExternalStore` over `umagrid:v1:daily:<n>` (external replacement updates the board) and `Persistence` accepts an optional `onCommit(prev, next)` callback; keep all 001 tests green
- [X] T017 [P] Add ESLint `no-restricted-imports` so `src/game/**`, `src/components/**`, and `src/hooks/useGame.ts` cannot statically import `@supabase/*`, `@/backend/*`, or `@/sync/*` (must go through `loadBackend()`)

**Checkpoint**: `npm run db:reset && npm run backend:sync-puzzles -- --local && npm run db:test` pass; parity test passes; 001 E2E still green.

---

## Phase 3: User Story 1 - Create an account and keep my progress (Priority: P1) 🎯 MVP

**Goal**: Magic-link sign-in; local history and today's game imported; every guess synced; offline-safe.

**Independent Test**: quickstart A2, A3, A4.

### Tests for User Story 1

- [X] T018 [P] [US1] Unit tests for `decideMerge` (no server → push-local; server prefix → flush-remainder from n; divergent → adopt-server with `discardedLocal`) in `tests/unit/sync/merge.test.ts`
- [X] T019 [P] [US1] Unit tests for outbox (FIFO, persistence across reload, stop on `retry`, `conflict` and `rejected` drop the puzzle's ops and never block later puzzles, `drop(puzzle)`, backoff 1 s → 60 s) in `tests/unit/sync/outbox.test.ts`
- [X] T020 [P] [US1] pgTAP `supabase/tests/import.test.sql`: `import_local` replays/validates sessions, skips puzzles with existing sessions, stores legacy history only when no session exists, clamps/validates input, sets `imported = true`, max 400 items
- [X] T021 [P] [US1] E2E `tests/e2e/accounts/sign-in-import.spec.ts`: play 2 days as guest → Sign in with email → read magic link from Mailpit API (`http://localhost:54324`) → stats and today's board unchanged → DB has 2 sessions; sign out clears account data
- [X] T022 [P] [US1] E2E `tests/e2e/accounts/offline-sync.spec.ts`: signed in, `context.setOffline(true)`, 3 guesses, back online → `get_my_daily` shows 3 guesses within 5 s; playing a practice grid while signed in sends no `record_guess` request (FR-013)

### Implementation for User Story 1

- [X] T023 [US1] Add `import_local(p_sessions, p_history)` and `get_my_history()` to a new migration `supabase/migrations/<ts>_import_history.sql` per contracts (replay via `apply_guess`, `imported = true`, `legacy_history` rules)
- [X] T024 [P] [US1] Implement `src/sync/merge.ts` (`decideMerge`) per contracts/client-sync.md
- [X] T025 [P] [US1] Implement `src/sync/outbox.ts` (`umagrid:v1:outbox`, enqueue/pending/drop/flush with exponential backoff; `send` outcomes `ok | conflict | rejected | retry` per contracts/client-sync.md)
- [X] T026 [US1] Implement `src/backend/auth.ts`: `signInWithEmail(email)` (`signInWithOtp`, `emailRedirectTo = origin + "/auth/callback"`), `signOut()` (also removes `outbox`, `sync:*`, cached account history), `onAuthChange(cb)`; Google/Discord functions stubbed with `// TODO(FR-002)` and not exported to UI
- [X] T027 [US1] Implement `src/sync/syncEngine.ts`: `startSync(userId)` → first-time import of local sessions/history (`sync:importedFor`), `onLocalCommit` → enqueue op with `index`, flush via `record_guess`/`give_up`, on `conflict` adopt server session (write local daily key, `drop(puzzle)`, set `sync:notice`), on permanent rejection codes (`puzzle_unavailable`, `unknown_trainee`, `bad_cell`, `game_over`, `cell_filled`, `trainee_used`) map to `rejected`: drop the op, re-fetch and adopt the server session, `console.error` (never retry); flush on `online`/`visibilitychange`
- [X] T028 [US1] Create `src/app/auth/callback/page.tsx` (client-only): `exchangeCodeForSession(code)` then redirect to `/`; show friendly error for expired/foreign-browser links (messages `auth.callbackError`)
- [X] T029 [US1] Implement `src/hooks/useAuth.ts`: `{ status: "disabled" | "guest" | "loading" | "signed-in", user }`; loads backend only if `backendEnabled && hasStoredSession()` or after user action
- [X] T030 [P] [US1] Implement `src/components/SignInDialog.tsx` (email field, send link, "check your email" state, error states; no Google/Discord buttons yet) and `src/components/AccountMenu.tsx` (Sign in / account email + Sign out); add to `AppHeader` only when `backendEnabled`
- [X] T031 [US1] Wire `DailyGame` persistence `onCommit` to `syncEngine.onLocalCommit` when signed in; statistics read from synced history (`get_my_history` cached into `umagrid:v1:history`) when signed in
- [X] T032 [US1] Add `auth` and `sync` namespaces to `messages/en.json` (sign in, email sent, callback errors, signed in as, sign out, syncing/offline indicators)

**Checkpoint**: US1 E2E green; guest flow unchanged.

---

## Phase 4: User Story 2 - Continue on another device (Priority: P1)

**Goal**: Same account on two devices shows the same daily game; first device wins on conflict.

**Independent Test**: quickstart A5, A6.

### Tests for User Story 2

- [X] T033 [P] [US2] E2E `tests/e2e/accounts/two-devices.spec.ts`: two browser contexts, same account (magic link each) → 3 guesses on A → B shows same cells/remaining; finished on A → B shows finished
- [X] T034 [P] [US2] E2E `tests/e2e/accounts/conflict.spec.ts`: B offline guesses differently while A syncs first → B online adopts A's session and shows the "other device's game was kept" notice

### Implementation for User Story 2

- [X] T035 [US2] On signed-in load in `src/sync/syncEngine.ts`: fetch `get_my_daily(today)` + `get_my_history()`, apply `decideMerge`, refresh on `visibilitychange`
- [X] T036 [P] [US2] Implement `src/components/SyncNotice.tsx` (reads/clears `sync:notice`, `role="status"`) and render it in `DailyGame`
- [X] T037 [US2] Add `sync.otherDeviceKept` and related strings to `messages/en.json`

---

## Phase 5: User Story 3 - Manage my profile and data (Priority: P2)

**Goal**: Display name, leaderboard opt-out, export, delete.

**Independent Test**: quickstart A9, A10.

### Tests for User Story 3

- [ ] T038 [P] [US3] pgTAP `supabase/tests/privacy.test.sql`: profile auto-created with `Trainer-######` for permanent users only; backfill creates profiles for permanent users that existed before the migration; name rules (`name_length`, `name_chars`, `name_reserved`, `name_taken` case-insensitive); export contains only caller data; `delete_my_account` removes auth user, profile, sessions, legacy history while `answer_counts`/`puzzle_stats` stay unchanged
- [ ] T039 [P] [US3] E2E `tests/e2e/accounts/account-page.spec.ts`: rename, toggle opt-out, download export JSON (check keys), delete with confirmation → signed out and data gone

### Implementation for User Story 3

- [ ] T040 [US3] Migration `supabase/migrations/<ts>_profile_privacy.sql`: trigger on `auth.users` insert/update (create profile when user is not anonymous), backfill profiles for existing permanent users, seed `reserved_names`, RPCs `get_my_profile` (returns email, no providers list), `update_profile`, `export_my_data`, `delete_my_account` per contracts
- [ ] T041 [US3] Add wrappers to `src/backend/api.ts` for profile/export/delete
- [ ] T042 [US3] Create `src/app/account/page.tsx` (client-only): signed-in email, display name form with inline validation errors, opt-out switch, "Download my data" (Blob → `umagrid-export.json`), delete flow requiring typed confirmation; redirect guests to sign in
- [ ] T043 [P] [US3] Update `src/app/about/page.tsx` + `messages/en.json` privacy section (FR-026): data stored, purpose, 13+ notice, export/delete instructions, anonymous guest rarity submission
- [ ] T044 [US3] Add `account` namespace strings to `messages/en.json`

---

## Phase 6: User Story 4 - See how rare my answers are (Priority: P2)

**Goal**: Per-cell % and total rarity score in results; guests contribute anonymously.

**Independent Test**: quickstart A11, A12.

### Tests for User Story 4

- [ ] T045 [P] [US4] Unit tests for `cellRarity`/`rarityScore` (empty/wrong = 100, unavailable below threshold, rounding) in `tests/unit/game/rarity.test.ts`
- [ ] T046 [P] [US4] pgTAP `supabase/tests/stats.test.sql`: counts increment once when a non-imported session becomes final; imported sessions never counted; `get_rarity` returns `cells = null` below 20 games; `submit_guest_result` anonymous-only, replay-validated, `already_submitted` on second call; future puzzles hidden
- [ ] T047 [P] [US4] E2E `tests/e2e/accounts/rarity.spec.ts`: seed 25 finished games via SQL; finish game → results show per-cell % and total; with 5 games → "not enough players yet"; backend down → "unavailable"

### Implementation for User Story 4

- [ ] T048 [US4] Migration `supabase/migrations/<ts>_stats.sql`: trigger updating `puzzle_stats`/`answer_counts`, RPCs `get_rarity` (anon + authenticated) and `submit_guest_result` (anonymous only), `pg_cron` daily job deleting anonymous users older than 30 days
- [ ] T049 [P] [US4] Implement `src/game/rarity.ts` per contracts/client-sync.md
- [ ] T050 [US4] Add `ensureGuestSession()` to `src/backend/auth.ts` and guest submission on daily finish (lazy load, once per puzzle via `umagrid:v1:guestSubmitted:<n>`, silently skipped offline/disabled); puzzles finished while signed in are also added to `guestSubmitted` (kept on sign-out) so a device never re-submits them as a guest
- [ ] T051 [US4] Implement `src/hooks/useRarity.ts` (loads `get_rarity` after finish; states loading/insufficient/unavailable/ready)
- [ ] T052 [US4] Update `src/components/ResultsDialog.tsx`: per-cell % replaces the "—" slot, total rarity score, "not enough players yet (N/20)", unavailable state; update `src/game/share.ts` + `tests/unit/game/share.test.ts` to add an optional `Rarity: <score>` line (still no names)
- [ ] T053 [US4] Add `rarity` strings to `messages/en.json`

---

## Phase 7: User Story 5 - Leaderboards (Priority: P3)

**Goal**: Daily, weekly, monthly, all-time leaderboards with own rank.

**Independent Test**: quickstart A13.

### Tests for User Story 5

- [ ] T054 [P] [US5] pgTAP `supabase/tests/leaderboard.test.sql`: daily order score desc → rarity asc → finished_at asc; week/month/all aggregates and tiebreaks per FR-022; opted-out and anonymous users excluded; a deleted or newly opted-out user disappears from period leaderboards immediately, before any MV refresh; top 100 + caller `me`; no user ids/emails in output
- [ ] T055 [P] [US5] E2E `tests/e2e/accounts/leaderboard.spec.ts`: seeded accounts → tabs show correct order, own row highlighted, opt-out hidden

### Implementation for User Story 5

- [ ] T056 [US5] Migration `supabase/migrations/<ts>_leaderboards.sql`: `leaderboard_totals` materialized view + unique index, `pg_cron` refresh every 10 min (`concurrently`), RPC `get_leaderboard(p_period, p_key)` that inner-joins the MV with live `profiles` (display name and opt-out read live)
- [ ] T057 [P] [US5] Implement `src/hooks/useLeaderboard.ts` and `src/components/LeaderboardTable.tsx` (accessible table, rank/name/score/rarity, highlighted own row, "updated N min ago")
- [ ] T058 [US5] Create `src/app/leaderboard/page.tsx` with Daily/Weekly/Monthly/All-time tabs (Headless UI `TabGroup`), current period keys from `daily.ts`; add nav link in `AppHeader` when `backendEnabled`; strings in `messages/en.json`

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T059 Guest-only guarantee (A1, SC-004): CI step builds without Supabase env and runs the 001 E2E suite; add a unit/E2E check that a guest page load makes no requests to the Supabase URL
- [X] T060 [P] Bundle check: `npm run size` initial budget unchanged for guests; backend code only in lazy chunks
- [ ] T061 [P] Performance (A15, SC-007): `supabase/seed/load-test.sql` generating 10k sessions for one puzzle; measure `get_rarity`/`get_leaderboard` with `explain analyze` (target ≤ 300 ms DB time); add indexes if needed
- [ ] T062 [P] E2E accessibility: axe scan on `/account`, `/leaderboard`, Sign-in dialog; keyboard flow for sign-in in `tests/e2e/accounts/a11y.spec.ts`
- [ ] T063 Deploy to the existing Supabase project `xhykmwpgylwzvjqjfbgo` (user-assisted): `npx supabase db push`, Auth URL config (Site URL `https://<user>.github.io/<repo>/`, redirect `…/auth/callback/` + localhost), confirm anonymous sign-ins + rate limit, `npm run backend:sync-puzzles -- --prod` via `node --env-file=.env.production.secret`
- [ ] T064 Run quickstart A1–A15 and record results in `specs/002-player-accounts/checklists/requirements.md`
- [ ] T065 [P] GitHub Pages support: `next.config.ts` reads `NEXT_PUBLIC_BASE_PATH` for `basePath` and sets `trailingSlash: true`; add `withBasePath()` helper in `src/lib/basePath.ts` and use it for portrait `src`, the share URL, and the auth `emailRedirectTo`; existing E2E stays green with an empty base path
- [ ] T066 GitHub Pages deploy workflow `.github/workflows/deploy-pages.yml`: on push to `main`, build with repository variables `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_BASE_PATH`, upload `out/` with `actions/upload-pages-artifact`, deploy with `actions/deploy-pages`; add `out/.nojekyll`

---

## Deferred TODOs (no tasks in this feature)

- Google and Discord sign-in (FR-002/FR-003): enable providers in `supabase/config.toml` and dashboard, add buttons in `SignInDialog`, E2E for account linking.
- Custom SMTP provider before public sign-up (built-in mailer is development-only).
- Optional Cloudflare Turnstile CAPTCHA for anonymous sign-ins.

---

## Dependencies & Execution Order

- **Setup (1)** → **Foundational (2)** → user stories.
- **US1** depends on Phase 2. **US2** depends on US1 (sync engine). **US3** depends on Phase 2 (+ sign-in UI from US1 for E2E). **US4** depends on Phase 2 (guest path) and US1 for signed-in rarity. **US5** depends on US3 (profiles/opt-out) and US4 (rarity).
- **Polish** after desired stories; T063 can run once Phase 2 migrations are stable; T065 before T066; T066 before inviting players to the hosted site.

### Parallel Opportunities

- Setup: T003, T004, T005
- Foundational: T008, T011, T012 (tests) alongside T013, T014, T017
- US1: T018–T022 together; T024 ∥ T025; T030 after T026/T029
- US3 ∥ US4 after US1 (different migrations/files)

## Implementation Strategy

1. Phases 1–2, then US1 + US2 → MVP: accounts with cross-device progress (magic link).
2. Add US3 (privacy) before inviting real users (Constitution VI).
3. Add US4 rarity, then US5 leaderboards.
4. Before public launch: complete the Deferred TODOs (SMTP at minimum).
