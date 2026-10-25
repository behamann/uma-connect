# Quickstart & Validation: Player Accounts, Cloud Progress & Shared Stats

Design references: [plan.md](plan.md), [data-model.md](data-model.md), [contracts/](contracts/).

## Prerequisites

- Everything from feature 001 (Node 24, npm, Playwright Chromium).
- **Docker Desktop** (required by `supabase start` for the local stack).
- Supabase CLI: `npm install -D supabase` (run with `npx supabase …`).
- For production: the existing Supabase project (free tier). Google/Discord OAuth apps and custom
  SMTP are TODO (built-in dev mailer is used for now).

## Local development

| Step | Command / action |
|---|---|
| Start local stack | `npx supabase start` (prints API URL, publishable & secret keys; Mailpit at http://localhost:54324) |
| Apply migrations from scratch | `npx supabase db reset` |
| Load puzzles/answers | `npm run backend:sync-puzzles -- --local` |
| Env for the app | `.env.local` = **local stack only**: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local publishable>` (never production values) |
| Regenerate DB types | `npx supabase gen types typescript --local > src/backend/database.types.ts` |
| DB lint / tests | `npx supabase db lint` / `npx supabase test db` |
| Parity + unit | `npm test` (parity runs only when the local stack env is present) |
| Account E2E | `npm run test:e2e -- tests/e2e/accounts` |

`.env.local` is git-ignored and holds only local-stack values, so dev servers and E2E builds can
never reach production. The production secret key goes in `.env.production.secret` (also
git-ignored) and is read only by `npm run backend:sync-puzzles -- --prod`.

## Production setup (one time)

1. Supabase project already created (ref `xhykmwpgylwzvjqjfbgo`); publishable + secret keys exist.
2. Auth → URL configuration: Site URL `https://<user>.github.io/<repo>/`; redirect URLs
   `https://<user>.github.io/<repo>/auth/callback/`, `http://localhost:3000/auth/callback/`.
3. Enable providers: Email (magic link); enable **Anonymous sign-ins**; set anonymous sign-in
   rate limit. Keep the built-in mailer for now (TODO: Google, Discord, custom SMTP).
4. `npx supabase link --project-ref xhykmwpgylwzvjqjfbgo` (done) then `npx supabase db push`.
5. Put `SUPABASE_URL` + `SUPABASE_SECRET_KEY` in `.env.production.secret`, then
   `npm run backend:sync-puzzles -- --prod` (CI: repository secret `SUPABASE_SECRET_KEY`).
6. GitHub repository variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
   `NEXT_PUBLIC_BASE_PATH` (e.g. `/Umagrid`); enable Pages → "GitHub Actions"; push to `main`
   to run the deploy workflow.

## Validation scenarios

| # | Scenario | How | Expected |
|---|---|---|---|
| A1 | Guest unaffected (FR-001, SC-004) | Build without env vars; run 001 E2E suite | All pass; no backend requests |
| A2 | Magic link sign-up + import (US1) | E2E: play 2 days as guest \u2192 sign in via Mailpit link | History/stats unchanged; rows in DB |
| A3 | Guess sync (FR-006, SC-002) | E2E signed in: guess \u2192 query `get_my_daily` | Stored \u2264 5 s |
| A4 | Offline then online (AS-3) | `context.setOffline(true)` \u2192 3 guesses \u2192 online | Outbox flushed; DB matches |
| A5 | Second device (US2) | Two contexts, same account | Device B shows same cells/guesses |
| A6 | First device wins (FR-012) | B offline guesses differently, A online first | B adopts A's session + notice |
| A7 | Invalid guesses rejected (FR-010, SC-005) | pgTAP: each rejection code | 100% rejected |
| A8 | RLS isolation (VI, SC-005) | pgTAP as user A vs B, anon | No cross-user reads/writes; no table access |
| A9 | Profile rules (FR-014\u201316) | pgTAP + E2E rename | Length/chars/reserved/unique enforced |
| A10 | Export & delete (FR-017/18, SC-006) | E2E export file; delete \u2192 pgTAP counts | File complete; 0 personal rows left; aggregates intact |
| A11 | Rarity (US4) | Seed 25 finished games; open results | Per-cell % and total match `rarity.ts`; < 20 \u2192 "not enough players" |
| A12 | Guest rarity (FR-020) | Guest finishes \u2192 `submit_guest_result` | Counted once; second submit `already_submitted` |
| A13 | Leaderboards (US5) | Seed accounts; refresh MV | Order per FR-022; opt-out hidden; own rank shown |
| A14 | Parity (Constitution IV) | `tests/integration/parity.test.ts` | DB answers == engine; replay outcomes equal |
| A15 | Performance (SC-007) | Seed 10k sessions; time `get_rarity`/`get_leaderboard` | \u2264 2 s each (target \u2264 300 ms DB time) |
