# Implementation Plan: Umagrid Daily Grid (Frontend PoC)

**Branch**: `001-daily-grid-poc` | **Date**: 2026-10-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-daily-grid-poc/spec.md`

## Summary

A static, frontend-only 3x3 daily grid trivia game themed on Umamusume trainee versions. Rules,
validation, grid generation, search, scoring, share text, and statistics live in a pure
TypeScript game engine (`src/game/`). The dataset (characters, trainee versions, categories,
daily schedule) is versioned JSON in `data/`, validated by Zod schemas and a solvability check
(bipartite matching) in CI. The UI is a Next.js App Router static export with Tailwind, Headless
UI for the accessible combobox/dialogs, and next-intl for externalized English strings. Player
state persists in `localStorage`. See [research.md](research.md) for decisions.

## Technical Context

**Language/Version**: TypeScript 5.x (`strict`), Node.js 24 LTS for tooling

**Primary Dependencies**: Next.js 16 (App Router, `output: 'export'`), React 19, Tailwind CSS 4,
next-intl (single locale, no i18n routing), Headless UI (Combobox, Dialog), Zod (dataset schema)

**Storage**: Browser `localStorage` (versioned keys); dataset as static JSON files bundled at build

**Testing**: Vitest (engine, dataset, schedule), Playwright (E2E with fixed clock)

**Target Platform**: Evergreen browsers (last 2 versions of Chrome, Safari iOS, Firefox, Edge);
static hosting (Vercel or GitHub Pages)

**Project Type**: Static web application (single project)

**Performance Goals**: Grid interactive ≤ 2 s on mid-range phone / 4G (SC-007); search results
update per keystroke in < 50 ms over the full roster

**Constraints**: No server/runtime third-party APIs; JS + CSS + dataset needed to play ≤ 300 KB gzipped
(revised from 250 KB: the Next.js 16 + React 19 runtime alone is ~190 KB gz; checked by `npm run size`);
portraits lazy-loaded; WCAG 2.1 AA; usable from 360 px width

**Scale/Scope**: Hundreds of trainee versions, ~50 categories in 9 groups, 3 routes
(`/`, `/practice`, `/about`), ~10 UI components

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Pre-research | Post-design |
|---|---|---|---|
| I. Data Integrity & Explicit Rules | Answers derived only from dataset; every category has a rule text; every field has a source; CI check ≥ 3 answers/cell + perfect matching to 9 distinct characters | PASS | PASS — `data-model.md` maps every field to a source ref; `scripts/validate-data.ts` + `tests/data/` enforce solvability without reusing a character |
| II. Frontend-Only PoC | Static export, no backend/accounts, `localStorage`, date-deterministic daily grid | PASS | PASS — committed `schedule.json` + UTC puzzle number; rarity is a UI placeholder only |
| III. i18n-Ready | No hardcoded UI strings; dataset labels per locale; locale-aware formatting | PASS | PASS — `messages/en.json` via next-intl; `LocalizedText` in dataset; `Intl` for dates/countdown |
| IV. Pure, Tested Game Logic | Engine framework-agnostic with unit tests; E2E for main flow | PASS | PASS — `src/game/` has no React/DOM imports (lint rule); contracts in `contracts/game-engine.md` |
| V. Simplicity & Accessibility | Dependencies justified; keyboard + screen reader; mobile-first | PASS | PASS — runtime and dev deps justified in research; Headless UI provides ARIA combobox/dialog; cells expose accessible names |

No violations; Complexity Tracking is empty.

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
data/
├── characters.json        # shared character attributes (profile + real horse)
├── trainees.json          # trainee versions (answers) with aptitudes
├── categories.json        # category groups + categories with match rules
└── schedule.json          # daily puzzles: puzzle number → 6 category IDs

public/
└── portraits/             # self-hosted trainee portraits (<traineeId>.webp)

messages/
└── en.json                # all UI strings (next-intl)

scripts/
├── validate-data.ts       # schema + rule + solvability checks (CI, prebuild)
└── generate-schedule.ts   # appends N validated daily puzzles to schedule.json

src/
├── app/
│   ├── layout.tsx         # NextIntlClientProvider, fan notice footer
│   ├── page.tsx           # daily game
│   ├── practice/page.tsx  # practice game (?seed=)
│   └── about/page.tsx     # credits, sources, disclaimer
├── components/
│   ├── GameBoard.tsx      # grid + headers + guesses counter
│   ├── GridCell.tsx
│   ├── CategoryHeader.tsx # label + rule popover
│   ├── GuessDialog.tsx    # combobox search
│   ├── ResultsDialog.tsx  # score, answers, rarity slot, share, countdown
│   ├── HowToPlayDialog.tsx
│   ├── StatsDialog.tsx
│   ├── Countdown.tsx      # time until next daily puzzle
│   └── Portrait.tsx       # lazy image with name fallback
├── game/                  # pure engine — no React/DOM imports
│   ├── types.ts
│   ├── dataset.ts         # Zod schemas, loadDataset/loadSchedule, indexes
│   ├── data.ts            # imports data/*.json → validated dataset + schedule singletons
│   ├── text.ts            # localize(), displayName()
│   ├── categories.ts      # match-rule evaluation
│   ├── grid.ts            # resolve answers per cell, solvability (matching)
│   ├── generator.ts       # seeded grid generation
│   ├── rng.ts             # seeded PRNG
│   ├── daily.ts           # UTC date ↔ puzzle number, schedule lookup
│   ├── session.ts         # session reducer (guess, give up, finish)
│   ├── search.ts          # normalization + ranking
│   ├── share.ts           # share text
│   └── stats.ts           # stats from history
├── storage/
│   └── local.ts           # versioned localStorage adapter (safe when unavailable)
├── hooks/
│   └── useGame.ts         # binds engine + storage to React
└── i18n/
    └── request.ts         # next-intl config (locale = 'en')

tests/
├── fixtures/              # small synthetic datasets for unit tests
├── unit/game/             # Vitest: engine modules
├── unit/storage/          # Vitest: localStorage adapter
├── data/                  # Vitest: dataset integrity + every scheduled grid solvable
└── e2e/                   # Playwright: daily flow, resume, share, practice, a11y
```

**Structure Decision**: Single static web project. The engine (`src/game/`) is isolated so a
future backend (rarity stats) can reuse it; data lives outside `src/` so it can be validated and
edited independently of UI code.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations.
