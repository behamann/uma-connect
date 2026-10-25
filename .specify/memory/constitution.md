<!--
Sync Impact Report
- Version change: 1.0.0 → 2.0.0 (MAJOR: Principle II redefined)
- Modified principles:
  II. Frontend-Only Proof of Concept → II. Static Frontend, Managed Backend, Guest-First
  IV. Pure, Tested Game Logic (expanded: shared logic must also validate server-side results)
- Added principles: VI. Privacy & Security by Default
- Modified sections: Technology & Content Constraints (managed backend, secrets);
  Development Workflow & Quality Gates (migrations, access-policy tests)
- Removed sections: none
- Templates requiring updates: none (plan/spec/tasks templates read this file at runtime)
- Deferred TODOs: none
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

### II. Static Frontend, Managed Backend, Guest-First

- The site MUST remain deployable as static files; server-side logic lives only in the managed
  backend (database, auth, database functions), never in a custom always-on server.
- Playing MUST NOT require an account or a reachable backend: guests keep full gameplay with
  progress in browser storage, and signed-in players fall back to local play if the backend is
  unavailable, syncing later.
- The daily puzzle MUST stay deterministic for all players from the calendar date (UTC).
- Shared, cross-player data (rarity %, leaderboards) MUST only be derived from results the
  backend has validated; client-reported scores are never trusted as-is.

Rationale: keep the game fast, cheap, and resilient while adding accounts and shared features.

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
- Any rule the backend enforces (e.g. validating a submitted guess) MUST produce the same result
  as the shared TypeScript engine; parity MUST be covered by automated tests.

Rationale: rules are the product; they must be correct and identical everywhere they run.

### V. Simplicity & Accessibility

- Prefer the simplest solution that satisfies the current spec (YAGNI); new dependencies MUST be
  justified in the plan.
- The UI MUST be mobile-first, fully keyboard operable, and target WCAG 2.1 AA (contrast, focus
  states, labelled controls, screen-reader announcements for guess results).

Rationale: daily puzzle games are played mostly on phones and by a broad audience.

### VI. Privacy & Security by Default

- Collect only data needed for the feature (account identifier, display name, game results);
  no tracking or advertising data.
- Every database table MUST have access policies (row-level security) that deny by default; a
  player can only read/write their own private data. Public data (leaderboards, rarity) MUST be
  exposed only through aggregate or explicitly public views.
- Players MUST be able to export and permanently delete their account and data (LGPD/GDPR).
- Secrets (service keys) MUST never ship to the browser or the repository; only public,
  policy-restricted keys may be used client-side.
- Inputs from clients MUST be validated server-side; follow OWASP Top 10 guidance.

Rationale: accounts create trust obligations; a fan project must keep that risk minimal.

## Technology & Content Constraints

- Stack: Next.js (static export) + React + TypeScript (`strict`) + Tailwind CSS.
- Backend: managed Postgres + authentication service (decision recorded in the feature plan);
  schema changes MUST be versioned migrations in the repository.
- Testing: Vitest for logic/unit tests; Playwright for end-to-end tests.
- Dataset: versioned JSON (or TS) files in the repository, validated by a schema at build time.
- Hosting: any static host (e.g. Vercel, GitHub Pages) plus the managed backend.
- Umagrid is an unofficial fan project. Umamusume: Pretty Derby names, images, and materials are
  trademarks and copyrights of Cygames, Inc.; the site MUST display this notice and MUST credit
  the data/image sources it uses. Images MUST be self-hosted or from sources that permit reuse.
- The game MUST NOT depend on third-party APIs at runtime to be playable.

## Development Workflow & Quality Gates

- Features follow the Spec Kit flow: specify → clarify → plan → tasks → implement.
- Before merging, the following MUST pass: type-check, lint, unit tests, dataset schema
  validation, grid solvability check, and end-to-end tests.
- Any dataset or category-rule change MUST re-run grid validation for all scheduled puzzles.
- Database migrations MUST apply cleanly to an empty database, and access policies MUST have
  automated tests proving one player cannot read or modify another player's private data.

## Governance

- This constitution supersedes other project practices; plans MUST include a Constitution Check
  and justify any deviation in their Complexity Tracking section.
- Amendments are made via `/speckit-constitution`, recorded with a Sync Impact Report, and
  versioned with semantic versioning (MAJOR: principle removal/redefinition; MINOR: new
  principle/section; PATCH: clarification).
- Changes to how shared data is collected or exposed require reviewing Principle VI.

**Version**: 2.0.0 | **Ratified**: 2026-10-25 | **Last Amended**: 2026-10-25
