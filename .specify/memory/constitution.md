<!--
Sync Impact Report
- Version change: (template) → 1.0.0
- Principles defined:
  I. Data Integrity & Explicit Category Rules
  II. Frontend-Only Proof of Concept
  III. Internationalization-Ready
  IV. Pure, Tested Game Logic
  V. Simplicity & Accessibility
- Added sections: Technology & Content Constraints; Development Workflow & Quality Gates
- Removed sections: none
- Templates requiring updates: none (plan/spec/tasks templates read this file at runtime)
- Deferred TODOs: final category catalog to be decided during /speckit-specify + /speckit-clarify
-->
# Umagrid Constitution

Umagrid is a daily 3x3 grid trivia game themed on Umamusume: Pretty Derby, inspired by the
PokeDoku / Immaculate Grid format: each cell must be filled with one Umamusume that satisfies
both its row and column categories.

## Core Principles

### I. Data Integrity & Explicit Category Rules

- The character dataset is the single source of truth for answer validation; UI code MUST NOT
  hardcode answers.
- Every category MUST have a written, unambiguous membership rule (e.g. "Aptitude ≥ A",
  "anime-only characters excluded") documented alongside the dataset and shown to players.
- Every dataset field MUST record its source (wiki/game page) so values can be re-verified.
- Every published grid MUST have at least 3 valid answers per cell and MUST be solvable without
  reusing a character; this is enforced by an automated check, not by manual review.

Rationale: the game is only fair and fun if correctness is never debatable.

### II. Frontend-Only Proof of Concept

- The PoC MUST run as a static site with no custom backend, database, or user accounts.
- Player progress, history, and stats MUST persist in browser storage (`localStorage`).
- The daily puzzle MUST be deterministic for all players from the calendar date (UTC) so no
  server is needed to agree on "today's grid".
- Features that require shared server state (global rarity %, leaderboards) are OUT OF SCOPE
  for the PoC and MUST be designed so they can be added later without rewriting game logic.

Rationale: validate the gameplay loop and dataset before investing in infrastructure.

### III. Internationalization-Ready

- The PoC ships in English only.
- No user-facing string may be hardcoded in components; all text MUST come from locale message
  catalogs keyed by message ID.
- Character names, category labels, and rule texts in the dataset MUST be stored per locale
  (with `en` as the required default) so new languages are additive.
- Dates, numbers, and plurals MUST use locale-aware formatting APIs.

Rationale: adding a language later must not require touching game logic or components.

### IV. Pure, Tested Game Logic

- Game rules (answer validation, no-reuse, guess counting, puzzle generation, scoring) MUST live
  in framework-agnostic TypeScript modules with no UI or browser dependencies.
- These modules MUST have unit tests covering valid, invalid, and edge cases before the related
  UI is considered done.
- The primary player flow (open daily grid → guess → finish → share) MUST have an end-to-end test.

Rationale: rules are the product; they must be correct and reusable by a future backend.

### V. Simplicity & Accessibility

- Prefer the simplest solution that satisfies the current spec (YAGNI); new dependencies MUST be
  justified in the plan.
- The UI MUST be mobile-first, fully keyboard operable, and target WCAG 2.1 AA (contrast, focus
  states, labelled controls, screen-reader announcements for guess results).

Rationale: daily puzzle games are played mostly on phones and by a broad audience.

## Technology & Content Constraints

- Stack: Next.js (static export) + React + TypeScript (`strict`) + Tailwind CSS.
- Testing: Vitest for logic/unit tests; Playwright for end-to-end tests.
- Dataset: versioned JSON (or TS) files in the repository, validated by a schema at build time.
- Hosting: any static host (e.g. Vercel, GitHub Pages).
- Umagrid is an unofficial fan project. Umamusume: Pretty Derby names, images, and materials are
  trademarks and copyrights of Cygames, Inc.; the site MUST display this notice and MUST credit
  the data/image sources it uses. Images MUST be self-hosted or from sources that permit reuse.
- The game MUST NOT depend on third-party APIs at runtime to be playable.

## Development Workflow & Quality Gates

- Features follow the Spec Kit flow: specify → clarify → plan → tasks → implement.
- Before merging, the following MUST pass: type-check, lint, unit tests, dataset schema
  validation, grid solvability check, and end-to-end tests.
- Any dataset or category-rule change MUST re-run grid validation for all scheduled puzzles.

## Governance

- This constitution supersedes other project practices; plans MUST include a Constitution Check
  and justify any deviation in their Complexity Tracking section.
- Amendments are made via `/speckit-constitution`, recorded with a Sync Impact Report, and
  versioned with semantic versioning (MAJOR: principle removal/redefinition; MINOR: new
  principle/section; PATCH: clarification).
- Moving beyond the PoC (e.g. adding a backend for rarity scores) requires amending Principle II.

**Version**: 1.0.0 | **Ratified**: 2026-10-25 | **Last Amended**: 2026-10-25
