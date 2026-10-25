# Research: Umagrid Daily Grid (Frontend PoC)

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-25

## R1. Static hosting with Next.js

- **Decision**: Next.js 16 App Router with `output: 'export'`, `images.unoptimized: true`. All
  pages are client-rendered after a static shell; the daily puzzle is computed after mount.
- **Rationale**: Constitution II (no backend). Static export does not support middleware/proxy,
  cookies, or default image optimization, none of which the PoC needs. Computing the date on the
  client avoids hydration mismatches (build time ≠ play time).
- **Alternatives**: Vite + React SPA (lighter, but loses an easy path to SSR/API routes for the
  future rarity backend); Astro (less suited to a highly interactive single screen).

## R2. Internationalization

- **Decision**: next-intl used *without* i18n routing: one locale (`en`), messages in
  `messages/en.json`, `NextIntlClientProvider` in the root layout. Dataset text uses
  `LocalizedText = { en: string; [locale]?: string }`. Dates/countdown via `Intl` formatters.
- **Rationale**: Constitution III. Static export cannot use next-intl's routing middleware; when a
  2nd language is added, pages move under `app/[locale]/` with `generateStaticParams` and the root
  page performs a client-side redirect based on `navigator.language`.
- **Alternatives**: react-i18next (works, but less integrated with App Router server/client
  components); custom dictionary (no ICU plurals/formatting).

## R3. Daily puzzle determinism

- **Decision**: `puzzleNumber = floor((todayUTC − LAUNCH_DATE_UTC) / 1 day) + 1`. Daily grids are
  **pre-generated** into `data/schedule.json` (`puzzleNumber → {rows[3], cols[3]}`) by
  `scripts/generate-schedule.ts` and committed. Valid answers are always computed at runtime from
  the current dataset.
- **Rationale**: Freezing categories (not answers) keeps grids stable for all players while
  dataset fixes still apply. Enables curation and the 90-day non-repeat rule (FR-014). CI
  re-validates every scheduled grid whenever data changes (Constitution I).
- **Trade-off**: Future grids are readable in the bundle. Accepted for the PoC.
- **Missing entry**: If today has no schedule entry, show a friendly error (spec edge case);
  CI fails if the schedule covers fewer than 30 future days.
- **Alternatives**: Pure runtime seeded generation (no file, but any dataset change silently
  changes past/future grids).

## R4. Grid generation & solvability

- **Decision**: Seeded PRNG (mulberry32 seeded from a string hash) picks 6 distinct categories;
  candidate accepted when:
  1. ≥ 4 distinct category groups;
  2. each cell has ≥ 3 valid trainee versions from ≥ 2 distinct characters (FR-013);
  3. a perfect matching exists between the 9 cells and 9 distinct **characters** (a cell can
     take a character if any of its trainee versions is valid there; augmenting-path bipartite
     matching — tiny graph, trivial cost). This satisfies Constitution I ("solvable without
     reusing a character") while players may still use several versions of one character;
  4. for daily: signature (sorted 6 IDs) not used in the previous 90 days.
  Up to 500 attempts, then report failure. Practice uses the same generator with a random seed
  stored in the URL (`/practice?seed=…`) so practice grids are reproducible.
- **Rationale**: Same code validates daily and practice grids; matching guarantees FR-013.

## R5. Search

- **Decision**: Custom search over precomputed normalized strings: NFKD + strip diacritics
  (`ō → o`), lowercase, remove non-alphanumerics; index name, aliases, and version tag. Ranking:
  exact > name prefix > word prefix > substring; tie-break by original version first, then
  alphabetical. Max 8 results; versions of the same character are adjacent.
- **Rationale**: Roster is small (hundreds); no dependency needed and results are deterministic
  for SC-004 tests.
- **Alternatives**: Fuse.js (fuzzy typos) — add only if SC-004 fails in playtest.

## R6. Accessible UI primitives

- **Decision**: Headless UI `Combobox` and `Dialog`; grid rendered as `role="grid"` with roving
  focus; guess results announced via an `aria-live="polite"` region.
- **Rationale**: Constitution V. ARIA combobox is hard to build correctly; Headless UI is
  unstyled (fits Tailwind) and small.
- **Alternatives**: React Aria Components (excellent but heavier API surface); Radix (no combobox).

## R7. Dataset format & validation

- **Decision**: JSON files in `data/`, imported directly (bundled). Zod schemas in
  `src/game/dataset.ts`; `scripts/validate-data.ts` runs schemas plus cross-checks (unique IDs,
  referential integrity, every category matches ≥ 3 trainees, every scheduled grid solvable).
  Runs in `prebuild` and CI.
- **Rationale**: Constitution I. Bundle estimate: < 100 KB gzipped for data.
- **Alternatives**: TS data modules (type-checked, but harder to edit/import from scripts).

## R8. Data sources & acquisition

- **Decision**: Manual curation into JSON, each record with source URLs:
  - Profile (dorm, birthday) and real-horse facts: umamusu.wiki (CC BY-SA; also exposes Cargo
    structured data) and its `IRL:` pages; Umamusume fandom wiki as cross-check.
  - Aptitudes per trainee version: GameTora character pages (automated fetch was blocked by an
    ad redirect during research; data entered manually from the page).
  - Start with a seed of ~30 characters for development; complete the full trainee roster before
    playtest (SC-008).
- **Open data rules (documented in category rule texts)**:
  - **G1 wins**: count JRA G1, NAR JpnI, and overseas G1 races (e.g. Hokko Tarumae's JpnI dirt wins
    count). Race-specific categories name one race.
  - **Classic winner**: `includes` rule on `irl.g1Wins` with `values` = any of Satsuki Sho, Tokyo
    Yushun, Kikuka Sho, Oka Sho, Yushun Himba, Shuka Sho. "Tenno Sho" categories likewise list
    both Spring and Autumn race IDs.
  - **Sire line**: male-line descent recorded as a list of notable ancestors (e.g.
    `["hail-to-reason", "halo", "sunday-silence"]`).
  - **Birthday season**: Spring = Mar–May, Summer = Jun–Aug, Autumn = Sep–Nov, Winter = Dec–Feb.

## R9. Images & legal

- **Decision**: Self-host small WebP portraits in `public/portraits/<traineeId>.webp`; fallback to
  name-only when missing. Footer + `/about` page show an unofficial fan-project notice crediting
  Cygames, Inc. and listing data/image sources. No ads/monetization in the PoC.
- **Follow-up**: Review Cygames' Umamusume derivative-work guidelines before any public launch.

## R10. Persistence

- **Decision**: `localStorage` with versioned keys (`umagrid:v1:*`): one session per daily puzzle,
  a compact history list for stats, and settings (how-to-play seen). Statistics are *derived*
  from history (pure function) rather than stored, avoiding drift. All access wrapped in
  try/catch; unavailable storage falls back to in-memory state.

## R11. Testing

- **Decision**: Vitest for `src/game/**` and `tests/data/**`; Playwright for E2E with
  `page.clock` to fix the date (daily rollover, streaks) and `@axe-core/playwright` for an
  automated a11y smoke check.

## Runtime dependency justification (Constitution V)

| Dependency | Why |
|---|---|
| next, react, react-dom | Chosen stack (constitution) |
| next-intl | Externalized strings, ICU plurals, future locales (Principle III) |
| @headlessui/react | Accessible combobox/dialog (Principle V) |
| zod | Dataset schema validation (Principle I) |
