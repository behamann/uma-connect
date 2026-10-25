---

description: "Task list for Umagrid Daily Grid (Frontend PoC)"
---

# Tasks: Umagrid Daily Grid (Frontend PoC)

**Input**: Design documents from `/specs/001-daily-grid-poc/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included. Constitution IV requires unit tests for all game-engine modules and an
end-to-end test of the primary flow; tests within each story are written before the related UI.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story from spec.md (US1–US6)
- Paths are relative to the repository root (single static web project, see plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and tooling

- [ ] T001 Initialize Next.js 16 + React 19 + TypeScript project at repo root (App Router, `src/` dir, import alias `@/*`) producing `package.json`, `tsconfig.json` (`"strict": true`, `"resolveJsonModule": true`), `src/app/layout.tsx`, `src/app/page.tsx` — if `create-next-app` refuses the non-empty root (`.specify/`, `specs/`), scaffold in a temp folder and move the files
- [ ] T002 Configure static export in `next.config.ts`: `output: 'export'`, `images: { unoptimized: true }`, next-intl plugin pointing to `src/i18n/request.ts`
- [ ] T003 [P] Install and configure Tailwind CSS 4 in `src/app/globals.css` and `postcss.config.mjs` (mobile-first, base focus-visible styles)
- [ ] T004 [P] Install runtime deps `next-intl`, `@headlessui/react`, `zod` and dev deps `tsx`, `serve`, `@axe-core/playwright` in `package.json`
- [ ] T005 [P] Configure ESLint (flat config with `eslint-config-next`) + Prettier in `eslint.config.mjs` and `.prettierrc`; add `no-restricted-imports` for `src/game/**` forbidding `react`, `react-dom`, `next/*`, and DOM globals
- [ ] T006 [P] Configure Vitest in `vitest.config.ts` (node env, `@/*` alias, include `tests/unit/**` and `tests/data/**`)
- [ ] T007 [P] Configure Playwright in `playwright.config.ts` (webServer = `npm run build && npx serve out`, Chromium desktop + Pixel 7 viewport, `@axe-core/playwright` dev dep)
- [ ] T008 Add npm scripts to `package.json`: `dev`, `build`, `typecheck`, `lint`, `test`, `test:e2e`, `validate:data` (`tsx scripts/validate-data.ts`), `schedule` (`tsx scripts/generate-schedule.ts`); the `prebuild` hook (= `validate:data`) is added in T027 once the script exists
- [ ] T009 [P] Add CI workflow `.github/workflows/ci.yml` running install, typecheck, lint, `validate:data`, `test`, `build`, `test:e2e`
- [ ] T010 [P] Update `.gitignore` for `node_modules/`, `.next/`, `out/`, `playwright-report/`, `test-results/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Dataset, category rules, grid resolution/validation, daily schedule, i18n, storage —
required by every user story.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Engine core

- [ ] T011 Define shared types in `src/game/types.ts`: `LocalizedText = { en: string; [locale: string]: string }`, `Grade = "S"|"A"|"B"|"C"|"D"|"E"|"F"|"G"`, `Character`, `TraineeVersion`, `CategoryGroup`, `Category`, `MatchRule` (union of `aptitude | equals | birthMonth | includes` (with `values: string[]`, any-of) `| atLeast | range`), `Grid` (`rows`/`cols`: `[string,string,string]`, `kind: "daily"|"practice"`, `puzzleNumber?`, `seed?`), `ResolvedGrid` (`answers[r][c]: TraineeId[]`), `ScheduleEntry`, `GameSession`, `HistoryEntry`, `PlayerStatistics` per data-model.md
- [ ] T012 Implement Zod schemas and `loadDataset(raw)` in `src/game/dataset.ts` enforcing: unique IDs; `characterId` "Must reference an existing Character"; "Exactly one `true` per character" for `isOriginal`; `servers` "Non-empty"; every `LocalizedText` has `en`; `sources.profile`, `sources.irl`, and trainee `source` required; `birthday.month` 1–12, `day` 1–31; `dorm` in `"ritto" | "miho"`; returns `Dataset` maps (throws with readable messages on invalid)
- [ ] T013 [P] Implement `localize(text, locale)` (fallback to `en`) and `displayName(trainee, character, locale)` ("original → `name`; others → `name · versionTag`") in `src/game/text.ts`
- [ ] T014 Implement `matches(category, trainee, character)` in `src/game/categories.ts` for all `MatchRule` types (grade order S > A > … > G; `includes` is true when the array contains any of `values`; `aptitude` uses trainee aptitudes, all other rules use character fields)
- [ ] T015 Implement `resolveGrid(grid, ds)` and `checkGrid(resolved, ds)` in `src/game/grid.ts`: ≥ 3 answers per cell from ≥ 2 distinct characters, 6 distinct categories, ≥ 4 distinct groups, all categories enabled, perfect bipartite matching of the 9 cells to 9 distinct **characters** (a cell accepts a character if any of its trainee versions is valid there; augmenting path); returns `{ ok, problems[] }`
- [ ] T016 [P] Implement seeded PRNG (`hashSeed(string)` + mulberry32) in `src/game/rng.ts`
- [ ] T017 Implement `generateGrid(ds, seed, { exclude?, maxAttempts = 500 })` in `src/game/generator.ts` (deterministic; every returned grid passes `checkGrid`; `exclude` = set of sorted-ID signatures; returns `null` after max attempts)
- [ ] T018 Implement `puzzleNumberFor(dateUtc, launchDate)`, `dailyGrid(schedule, n)`, `msUntilNextPuzzle(now)` in `src/game/daily.ts` (puzzle changes exactly at 00:00 UTC)

### Engine tests

- [ ] T019 [P] Unit tests for `loadDataset` (valid fixture, each invalid rule rejected) in `tests/unit/game/dataset.test.ts` using fixtures in `tests/fixtures/dataset.ts`
- [ ] T020 [P] Unit tests for every `MatchRule` type incl. grade boundaries (A passes, B fails, S passes) and `includes` any-of semantics in `tests/unit/game/categories.test.ts`
- [ ] T021 [P] Unit tests for `resolveGrid`/`checkGrid` (insufficient answers, single-character cell, no perfect matching, grid solvable only by reusing a character via two versions → rejected, < 4 groups) in `tests/unit/game/grid.test.ts`
- [ ] T022 [P] Unit tests for `generateGrid` determinism, `exclude`, and `checkGrid` on 100 seeds in `tests/unit/game/generator.test.ts`
- [ ] T023 [P] Unit tests for `daily.ts` (UTC boundary at 23:59:59.999 vs 00:00, different time-zone offsets same UTC date, `msUntilNextPuzzle`) in `tests/unit/game/daily.test.ts`

### Data

- [ ] T024 Create category catalog `data/categories.json` per contracts/dataset.md with the 9 groups of FR-024 and ≥ 25 enabled categories, each with `label` and full `rule` text, applying research.md R8 rules (G1 = JRA G1 + NAR JpnI + overseas G1; Classic winner list; seasons Spring = Mar–May, Summer = Jun–Aug, Autumn = Sep–Nov, Winter = Dec–Feb)
- [ ] T025 Create seed dataset `data/characters.json` (~30 well-known characters incl. Hokko Tarumae) with profile + IRL fields and `sources` URLs from umamusu.wiki (`<Name>` and `IRL:<Name>` pages)
- [ ] T026 Create seed `data/trainees.json` with every trainee version of the seed characters, aptitudes entered from GameTora character pages, `source` URL per version, `portrait: null` until images are added
- [ ] T027 Implement `scripts/validate-data.ts`: run `loadDataset`, every enabled category matches ≥ 3 trainees, schedule rules from contracts/dataset.md §Validation 5–6; non-zero exit with a list of problems; then add `"prebuild": "npm run validate:data"` to `package.json`
- [ ] T028 Implement `scripts/generate-schedule.ts` (`--days N`, default 60): appends entries after the last scheduled date using `generateGrid(ds, "daily-<n>", { exclude: last 90 signatures })`; set `launchDate` and create `data/schedule.json`
- [ ] T029 Generate initial `data/schedule.json` (≥ 60 days) with `npm run schedule -- --days 60` and confirm `npm run validate:data` passes
- [ ] T030 [P] Data integrity test that loads real `data/*.json` and asserts `checkGrid(...).ok` for every scheduled puzzle in `tests/data/dataset.test.ts`

### App foundation

- [ ] T031 [P] Configure next-intl without i18n routing in `src/i18n/request.ts` (locale `en`) and create `messages/en.json` with namespaces `common`, `game`, `results`, `howToPlay`, `stats`, `practice`, `about`
- [ ] T032 Wrap app with `NextIntlClientProvider` and add footer with unofficial fan-project notice crediting Cygames, Inc. (text from `messages/en.json`) in `src/app/layout.tsx`
- [ ] T033 [P] Implement versioned storage adapter in `src/storage/local.ts`: `get/set/remove` under prefix `umagrid:v1:`, JSON parse guarded (corrupt → absent), try/catch with in-memory fallback when `localStorage` is unavailable
- [ ] T034 [P] Unit tests for storage adapter (corrupt value, unavailable storage fallback) in `tests/unit/storage/local.test.ts`
- [ ] T035 Create dataset singleton `src/game/data.ts` that imports `data/*.json`, calls `loadDataset`, and exports `dataset` and `schedule`

**Checkpoint**: `npm run validate:data` and `npm test` pass; a valid daily grid can be resolved for any scheduled date.

---

## Phase 3: User Story 1 - Play today's grid (Priority: P1) 🎯 MVP

**Goal**: Player fills today's 3x3 grid with trainee versions, 9 guesses, no reuse, give up.

**Independent Test**: Load the site on a fixed date, submit valid/invalid/used trainees, verify locking, guess counter, rejection without consuming a guess, and game end (quickstart V1, V2).

### Tests for User Story 1

- [ ] T036 [P] [US1] Unit tests for `session.ts`: correct/incorrect guess consumes one guess; `rejected` (state unchanged) when game finished, cell filled, or trainee already in `cells`; transitions to `completed`, `out_of_guesses`, `gave_up`; `score` = filled cells in `tests/unit/game/session.test.ts`
- [ ] T037 [P] [US1] Unit tests for `search.ts`: case/diacritic/punctuation-insensitive ("hokko", "Hokkō", "HOKKO-TARUMAE"), alias match, ranking exact > name prefix > word prefix > substring, original version first, limit 8, never filtered by cell validity in `tests/unit/game/search.test.ts`
- [ ] T038 [P] [US1] E2E core loop with fixed clock (valid guess locks cell, invalid guess consumes guess, used trainee shown unavailable and not submittable, give up ends game, 9 guesses ends game, date with no schedule entry shows friendly error) in `tests/e2e/play-daily.spec.ts`

### Implementation for User Story 1

- [ ] T039 [P] [US1] Implement session reducer in `src/game/session.ts` per contracts/game-engine.md (`newSession`, `submitGuess`, `giveUp`, `remainingGuesses`, `score`, `isFinished`); `cells` = 9 entries row-major
- [ ] T040 [P] [US1] Implement `buildSearchIndex(ds, locale)` and `search(index, query, limit = 8)` in `src/game/search.ts` (NFKD + strip diacritics, lowercase, strip non-alphanumerics; index name, aliases, versionTag)
- [ ] T041 [US1] Implement `useGame` hook (in-memory session for now) binding dataset, today's `dailyGrid`, `resolveGrid`, and session actions in `src/hooks/useGame.ts`
- [ ] T042 [P] [US1] Implement `Portrait` (lazy `<img>`, name-only fallback when `portrait` is null) in `src/components/Portrait.tsx`
- [ ] T043 [P] [US1] Implement `CategoryHeader` (label only) in `src/components/CategoryHeader.tsx`
- [ ] T044 [P] [US1] Implement `GridCell` (empty / filled with portrait + display name + version tag, disabled when locked or game over) in `src/components/GridCell.tsx`
- [ ] T045 [US1] Implement `GuessDialog` with Headless UI `Dialog` + `Combobox` over `search()`; used trainees rendered disabled with "Already used" label; submit calls `submitGuess` in `src/components/GuessDialog.tsx`
- [ ] T046 [US1] Implement `GameBoard` (`role="grid"`, 3 column + 3 row headers, 9 cells, remaining-guesses counter, "Give up" with confirm, `aria-live="polite"` region announcing correct/incorrect) in `src/components/GameBoard.tsx`
- [ ] T047 [US1] Render daily game in `src/app/page.tsx` (client component computing today's puzzle after mount; friendly error when no schedule entry) and add all US1 strings to `messages/en.json`
- [ ] T048 [US1] Show minimal end-of-game state (final score "X/9") on `GameBoard` when `isFinished` in `src/components/GameBoard.tsx`

**Checkpoint**: US1 playable end-to-end; `tests/e2e/play-daily.spec.ts` passes.

---

## Phase 4: User Story 2 - Resume and finish the daily game (Priority: P1)

**Goal**: Progress persists per day, finished games are locked, new grid after 00:00 UTC.

**Independent Test**: Play 3 guesses → reload → same state; finish → reload → finished view; advance clock past 00:00 UTC → new grid (quickstart V3, V4).

### Tests for User Story 2

- [ ] T049 [P] [US2] E2E resume/lock/rollover using `page.clock` in `tests/e2e/resume-daily.spec.ts`

### Implementation for User Story 2

- [ ] T050 [US2] Persist daily session to `umagrid:v1:daily:<puzzleNumber>` after every accepted guess / give up and restore on load in `src/hooks/useGame.ts`
- [ ] T051 [US2] Append `{ puzzleNumber, score, status }` to `umagrid:v1:history` (sorted by `puzzleNumber`, no duplicates) when a daily session reaches a terminal state in `src/hooks/useGame.ts`
- [ ] T052 [US2] Prune daily sessions older than 30 puzzles on load (keep history) in `src/storage/local.ts`
- [ ] T053 [P] [US2] Implement `Countdown` to next puzzle using `msUntilNextPuzzle` and `Intl` formatting in `src/components/Countdown.tsx`
- [ ] T054 [US2] Show finished state (read-only grid + `Countdown`) when today's session is terminal; keep the open game playable across 00:00 until reload in `src/components/GameBoard.tsx`

**Checkpoint**: US1 + US2 work together; reloads never lose a guess.

---

## Phase 5: User Story 3 - Review results and share (Priority: P2)

**Goal**: Results view with score, grid, all valid answers per cell, rarity placeholder, share text.

**Independent Test**: Finish a game; results show all valid answers; Share copies spoiler-free text (quickstart V5).

### Tests for User Story 3

- [ ] T055 [P] [US3] Unit tests for `shareText` (exact layout from contracts/storage-and-share.md, `🟩`/`⬜` row-major, no names or category labels, practice variant omits number) in `tests/unit/game/share.test.ts`
- [ ] T056 [P] [US3] E2E: finish game → results dialog lists valid answers per cell → Share → clipboard text matches contract in `tests/e2e/results-share.spec.ts`

### Implementation for User Story 3

- [ ] T057 [P] [US3] Implement `shareText(session, puzzleNumber, url, strings)` in `src/game/share.ts`
- [ ] T058 [US3] Implement `ResultsDialog` (score, player grid, per-cell list of all valid answers with display names, "Rarity" column showing "—" with `results.rarityUnavailable` tooltip, `Countdown`, Share button using Clipboard API with selectable-text fallback) in `src/components/ResultsDialog.tsx`
- [ ] T059 [US3] Open `ResultsDialog` automatically on game end and via a "Results" button afterwards in `src/components/GameBoard.tsx`; add strings to `messages/en.json`

**Checkpoint**: US3 independently verifiable on top of US1.

---

## Phase 6: User Story 4 - Understand the rules and categories (Priority: P2)

**Goal**: How to play on first visit; every category's rule readable from its header.

**Independent Test**: Clear storage → dialog appears once; activate any header → rule text shown (quickstart V6).

### Tests for User Story 4

- [ ] T060 [P] [US4] E2E: first visit shows How to play, dismissed state persists, reopen via button, category header shows rule text (keyboard and click) in `tests/e2e/rules.spec.ts`

### Implementation for User Story 4

- [ ] T061 [P] [US4] Implement `HowToPlayDialog` (rules: 9 guesses, row + column match, no reuse of a trainee version, versions are separate answers, daily reset 00:00 UTC) in `src/components/HowToPlayDialog.tsx`; strings in `messages/en.json`
- [ ] T062 [US4] Show `HowToPlayDialog` when `umagrid:v1:settings.howToPlaySeen` is false and set it on dismiss; add header "?" button in `src/app/page.tsx`
- [ ] T063 [US4] Add rule popover (Headless UI `Popover`, localized `rule` text) to `src/components/CategoryHeader.tsx`

**Checkpoint**: Rules discoverable without leaving the game.

---

## Phase 7: User Story 5 - Personal statistics (Priority: P3)

**Goal**: Played, average, perfect grids, current and best streak from local history.

**Independent Test**: Finish games on consecutive simulated days and after a gap; stats match (quickstart V7).

### Tests for User Story 5

- [ ] T064 [P] [US5] Unit tests for `computeStats` (3 consecutive → streak 3; gap → current 1, best preserved; current streak 0 if latest < today − 1; average and perfect) in `tests/unit/game/stats.test.ts`
- [ ] T065 [P] [US5] E2E: finish games across 3 clock-advanced days then open Statistics in `tests/e2e/stats.spec.ts`

### Implementation for User Story 5

- [ ] T066 [P] [US5] Implement `computeStats(history, todayPuzzle)` in `src/game/stats.ts`
- [ ] T067 [US5] Implement `StatsDialog` (locale-aware numbers via next-intl) in `src/components/StatsDialog.tsx` and add header button in `src/app/page.tsx`; strings in `messages/en.json`

**Checkpoint**: Stats derived purely from history.

---

## Phase 8: User Story 6 - Practice mode (Priority: P3)

**Goal**: Unlimited reproducible practice grids that never affect daily state or stats.

**Independent Test**: `/practice?seed=abc` twice → same grid; daily session/history unchanged (quickstart V8).

### Tests for User Story 6

- [ ] T068 [P] [US6] E2E: same seed → same grid; "New grid" changes seed; daily storage keys untouched; friendly message when no valid grid can be generated for a seed in `tests/e2e/practice.spec.ts`

### Implementation for User Story 6

- [ ] T069 [US6] Add practice mode to `useGame` (grid from `generateGrid(dataset, seed)`, in-memory session only, no history writes) in `src/hooks/useGame.ts`
- [ ] T070 [US6] Implement `src/app/practice/page.tsx` (reads `seed` via `useSearchParams` inside `Suspense`, generates a random seed when absent, "New grid" button, share uses practice variant); add nav link and strings in `messages/en.json`

**Checkpoint**: All user stories independently functional.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Full dataset, credits, accessibility, performance, final validation

- [ ] T071 Complete `data/characters.json` and `data/trainees.json` with every trainee version released on JP or Global (FR-023), each with source URLs; community romanization for JP-only names
- [ ] T072 [P] Add self-hosted WebP portraits to `public/portraits/<traineeId>.webp` and set `portrait` paths in `data/trainees.json`
- [ ] T073 Regenerate/extend `data/schedule.json` to ≥ 60 future days after dataset completion and re-run `npm run validate:data`
- [ ] T074 [P] Implement `src/app/about/page.tsx` with fan-project disclaimer, Cygames, Inc. credit, data/image source list (umamusu.wiki CC BY-SA, GameTora, fandom wiki); link from footer
- [ ] T075 [P] Search quality fixture test (≥ 95% of queries return intended trainee in top 5, SC-004; each query over the full roster completes in < 50 ms) in `tests/unit/game/search-quality.test.ts`
- [ ] T076 [P] E2E accessibility: keyboard-only full game, axe scan with 0 serious violations, 360 px viewport in `tests/e2e/a11y.spec.ts`
- [ ] T077 Verify bundle budget (JS + data ≤ 250 KB gzipped) and Lighthouse mobile interactive ≤ 2 s on `out/`; fix regressions (e.g. lazy-load `ResultsDialog`/`StatsDialog`)
- [ ] T078 Review Cygames' Umamusume derivative-work guidelines and adjust disclaimer/assets in `messages/en.json` if needed
- [ ] T079 Run all quickstart.md validation scenarios V1–V12 and record results in `specs/001-daily-grid-poc/checklists/requirements.md` notes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none
- **Foundational (Phase 2)**: depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: depends on Foundational
- **US2 (Phase 4)**: depends on US1 (extends `useGame` and `GameBoard`)
- **US3 (Phase 5)**: depends on US1; uses `Countdown` from US2 (T053)
- **US4 (Phase 6)**: depends on US1 (`CategoryHeader`, page shell)
- **US5 (Phase 7)**: depends on US2 (history written by T051)
- **US6 (Phase 8)**: depends on US1; independent of US2–US5
- **Polish (Phase 9)**: T071–T073 can start right after Phase 2 (data work); the rest after desired stories

### Within Phase 2

T011 → T012 → (T013, T014) → T015 → T016/T017 → T018; T024–T026 can proceed alongside engine work; T027–T029 need T012–T017 and data files; T030 needs T029; T035 needs T012 + data.

### Within Each User Story

Tests first (expected to fail) → engine module → hook → components → page wiring.

### Parallel Opportunities

- Setup: T003–T007, T009, T010
- Foundational: T013 ∥ T016; tests T019–T023; data entry T024–T026 ∥ engine; T031, T033, T034
- US1: T036–T038 together; T039 ∥ T040; T042–T044 together
- After US1: US4 and US6 can run in parallel with US2; US3 after T053

---

## Parallel Example: User Story 1

```text
Task: "Unit tests for session.ts in tests/unit/game/session.test.ts"
Task: "Unit tests for search.ts in tests/unit/game/search.test.ts"
Task: "E2E core loop in tests/e2e/play-daily.spec.ts"

Task: "Implement session reducer in src/game/session.ts"
Task: "Implement search in src/game/search.ts"

Task: "Implement Portrait in src/components/Portrait.tsx"
Task: "Implement CategoryHeader in src/components/CategoryHeader.tsx"
Task: "Implement GridCell in src/components/GridCell.tsx"
```

---

## Implementation Strategy

### MVP First

1. Phase 1 Setup → Phase 2 Foundational (seed data of ~30 characters is enough)
2. Phase 3 US1 → validate with quickstart V1/V2
3. Phase 4 US2 → daily game is credible (persistence + rollover) → demo

### Incremental Delivery

1. MVP (US1 + US2)
2. + US3 results/share and US4 rules → first playtest build
3. + US5 stats and US6 practice
4. Phase 9: full roster, portraits, a11y/perf, playtest for SC-008

---

## Notes

- `src/game/**` must stay free of React/Next/DOM imports (lint-enforced, Constitution IV)
- No hardcoded UI strings — every new text goes to `messages/en.json` (Constitution III)
- Any change in `data/` must keep `npm run validate:data` green (Constitution I)
- Commit after each task or logical group
