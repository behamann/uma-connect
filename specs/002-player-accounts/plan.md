# Implementation Plan: Player Accounts, Cloud Progress & Shared Stats

**Branch**: `002-player-accounts` | **Date**: 2026-10-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-player-accounts/spec.md`

## Summary

Add optional accounts (email magic link now; Google and Discord deferred as TODO) on Supabase while the site stays a
static export. The browser keeps playing from local state (guest-first); signed-in players sync
each guess to Postgres through a small set of `SECURITY DEFINER` RPC functions that re-validate
every guess against **answers precomputed by the existing TypeScript engine** (so rules are never
re-implemented in SQL). Guests' finished games feed rarity through lazy anonymous sign-in.
Rarity is aggregated in Postgres; daily leaderboards are computed on read and weekly/monthly/
all-time ones from a materialized view refreshed by `pg_cron`. All tables use deny-by-default
RLS with no direct table access from clients. See [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.9 (`strict`), Node.js 24; SQL/PL/pgSQL on Postgres 17 (Supabase)

**Primary Dependencies**: existing stack + `@supabase/supabase-js` 2.x (auth + RPC); Supabase CLI
(dev only: local stack, migrations, `supabase test db` with pgTAP, type generation)

**Storage**: Supabase Postgres (accounts data, sessions, aggregates); browser `localStorage` stays
the source of truth for gameplay and holds the sync outbox

**Testing**: Vitest (rarity math, sync merge rules, outbox, parity against local DB), pgTAP (RLS,
RPC validation, aggregates, deletion), Playwright against the local Supabase stack (Mailpit for
magic links, offline/two-device scenarios)

**Target Platform**: Static site on GitHub Pages (project site with base path) + Supabase hosted
project (free tier, ref `xhykmwpgylwzvjqjfbgo`)

**Project Type**: Static web app + managed backend (database migrations and functions in repo)

**Performance Goals**: guess saved ≤ 5 s p99 (SC-002); rarity/leaderboard reads ≤ 2 s at 10k games
(SC-007); backend code lazy-loaded so it does not delay first interaction

**Constraints**: guest gameplay must not load or wait for backend code (Principle II); no secret key
in browser or repo (VI); free-tier limits: 500 MB DB, 50k MAU (SC-008); site must work when
`NEXT_PUBLIC_SUPABASE_*` env vars are absent (backend disabled)

**Scale/Scope**: up to 1,000 DAU initially; ~10 tables/views, ~12 RPC functions, 3 new routes
(`/account`, `/leaderboard`, `/auth/callback`), ~8 new components

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Pre-research | Post-design |
|---|---|---|---|
| I. Data Integrity | Server validation uses the same dataset/rules | PASS | PASS — `puzzle_answers` generated from the engine by `scripts/backend/sync-puzzles.ts`; parity test |
| II. Static + Managed Backend + Guest-First | Static export kept; play never waits for backend; shared stats only from validated results | PASS | PASS — lazy `supabase-js`; outbox sync; env-less build = guest only; rarity counts only validated sessions |
| III. i18n-Ready | New UI strings externalized | PASS | PASS — `account`, `auth`, `leaderboard`, `rarity` namespaces in `messages/en.json` |
| IV. Pure, Tested Logic + parity | Backend rules match engine; tests prove it | PASS | PASS — rules reduced to membership checks on engine output; `tests/integration/parity.test.ts`; pure `rarity.ts`/`merge.ts` |
| V. Simplicity & Accessibility | Deps justified; a11y | PASS | PASS — one runtime dep (`supabase-js`); new pages covered by axe E2E |
| VI. Privacy & Security | RLS deny-by-default; export/delete; no secrets client-side; server-side validation | PASS | PASS — no table grants to `anon`/`authenticated`; RPC-only access; pgTAP isolation tests; secret key only in CI/dev script |

Complexity Tracking: one justified item (below).

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)
```text
supabase/                         # Supabase CLI project (new)
├── config.toml                   # auth providers, redirect URLs, rate limits, anon sign-ins
├── migrations/
│   ├── <ts>_core_schema.sql      # puzzles, puzzle_answers, trainees, profiles, sessions, history
│   ├── <ts>_rls_and_grants.sql   # RLS on, revoke all table grants from anon/authenticated
│   ├── <ts>_game_functions.sql   # apply_guess, record_guess, submit_guest_result, import_local, get_my_*
│   ├── <ts>_stats.sql            # answer_counts/puzzle_stats triggers, get_rarity, leaderboards, pg_cron
│   └── <ts>_profile_privacy.sql  # profile trigger, update_profile, export_my_data, delete_my_account
└── tests/                        # pgTAP (supabase test db)
    ├── rls.test.sql
    ├── guesses.test.sql
    ├── stats.test.sql
    └── privacy.test.sql

scripts/backend/
└── sync-puzzles.ts               # engine → upsert trainees, puzzles, puzzle_answers (--local default, --prod via .env.production.secret)

.github/workflows/
└── deploy-pages.yml              # build with repo variables → GitHub Pages

src/
├── backend/                      # lazy-loaded; never imported by guest-only code paths
│   ├── config.ts                 # reads NEXT_PUBLIC_SUPABASE_*; `backendEnabled`
│   ├── client.ts                 # createClient (PKCE, localStorage session)
│   ├── database.types.ts         # generated (`supabase gen types`)
│   ├── auth.ts                   # magic link, OAuth, sign-out, anonymous sign-in for guests
│   └── api.ts                    # typed RPC wrappers (contracts/database-api.md)
├── sync/
│   ├── merge.ts                  # pure: decide local vs server session (first device wins)
│   ├── outbox.ts                 # persisted queue of pending guesses, retry/backoff
│   └── syncEngine.ts             # flush, adopt server state, import on first sign-in
├── game/
│   └── rarity.ts                 # pure: per-cell % and total rarity score
├── lib/
│   └── basePath.ts               # withBasePath() for GitHub Pages project sites
├── hooks/
│   ├── useAuth.ts                # session state via onAuthStateChange (lazy client)
│   ├── useGame.ts                # + external session replacement + sync hook
│   ├── useRarity.ts
│   └── useLeaderboard.ts
├── components/
│   ├── SignInDialog.tsx          # email magic link (Google/Discord buttons: TODO)
│   ├── AccountMenu.tsx           # header button: sign in / account / sign out
│   ├── SyncNotice.tsx            # "other device's game was kept" message
│   └── LeaderboardTable.tsx
└── app/
    ├── account/page.tsx          # display name, opt-out, export, delete
    ├── leaderboard/page.tsx      # daily / weekly / monthly / all-time tabs
    └── auth/callback/page.tsx    # PKCE code exchange (client-side)

tests/
├── unit/game/rarity.test.ts
├── unit/sync/{merge,outbox}.test.ts
├── integration/parity.test.ts    # local DB vs engine (skipped without local stack)
└── e2e/accounts/*.spec.ts        # sign-in, sync, two devices, offline, delete, rarity, leaderboard
```

**Structure Decision**: Keep the single static web project; add a `supabase/` folder for
migrations and DB tests, and isolate all backend-aware browser code in `src/backend/` and
`src/sync/` behind dynamic imports so guests never download it until needed.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Guess checks (cell empty, no reuse, ≤ 9 guesses, finished) duplicated in PL/pgSQL alongside `session.ts` | Server must not trust clients (Principle II/VI) | Edge Function running the TS engine: adds Deno deploy + cold starts and still needs DB transactions; category logic itself is NOT duplicated (precomputed answers), and parity tests cover the remaining checks |
