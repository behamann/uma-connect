# Quickstart & Validation: Umagrid Daily Grid (Frontend PoC)

Design references: [plan.md](plan.md), [data-model.md](data-model.md),
[contracts/](contracts/).

## Prerequisites

- Node.js 24 LTS, npm
- Playwright browsers: `npx playwright install --with-deps chromium`

## Commands (defined in `package.json`)

| Command | Purpose |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Dev server at http://localhost:3000 |
| `npm run validate:data` | Dataset schema, references, category coverage, schedule solvability |
| `npm run schedule -- --days 60` | Append validated daily puzzles to `data/schedule.json` |
| `npm run typecheck` / `npm run lint` | TS strict check / ESLint (incl. no React/DOM in `src/game`) |
| `npm test` | Vitest unit + data tests |
| `npm run test:e2e` | Playwright E2E (fixed clock) |
| `npm run build` | `validate:data` then static export to `out/` |

## Validation scenarios

| # | Scenario | How | Expected |
|---|---|---|---|
| V1 | Core loop (US1) | E2E with fixed date; guess a known valid trainee, an invalid one, an already-used one | Cell locks; wrong guess consumes a guess; used trainee shown unavailable, no guess consumed |
| V2 | Game end (US1) | E2E: spend 9 guesses / fill 9 cells / give up | Results dialog opens; no more guesses accepted |
| V3 | Resume (US2) | E2E: 3 guesses → reload | Same cells, remaining = 6 |
| V4 | Same grid for all (US2) | Unit: `dailyGrid(puzzleNumberFor(date))` across time zones | Identical grid for the same UTC date; changes at 00:00 UTC |
| V5 | Results & share (US3) | E2E: finish game, click Share, read clipboard | Text matches [share contract](contracts/storage-and-share.md#share-text-fr-018), no names |
| V6 | Rules (US4) | E2E: clear storage → load; click a category header | How to play shown once; rule text visible |
| V7 | Stats (US5) | Unit: `computeStats` with consecutive/missing days; E2E with clock advance | Played/streak values per spec |
| V8 | Practice (US6) | E2E: open `/practice?seed=abc` twice; check daily state | Same grid for same seed; daily untouched |
| V9 | Data integrity (SC-003) | `npm run validate:data` | 0 errors; all scheduled grids pass FR-013 |
| V10 | Search quality (SC-004) | Unit: fixture of queries incl. "hokko", "Hokkō", "spe week" | Intended trainee in top 5 for ≥ 95% |
| V11 | Accessibility (FR-028/029) | E2E keyboard-only full game; axe scan; 360 px viewport | Completable; 0 serious axe violations |
| V12 | Performance (SC-007) | Lighthouse mobile on `out/` | Interactive ≤ 2 s; JS + data ≤ 250 KB gz |
