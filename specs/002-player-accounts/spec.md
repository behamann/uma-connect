# Feature Specification: Player Accounts, Cloud Progress & Shared Stats

**Feature Branch**: `002-player-accounts`

**Created**: 2026-10-25

**Status**: Draft

**Input**: User description: "Start the backend and database parts: players should be able to create an account on the site to keep their progress. Sign-in with email magic link, Google, and Discord; accounts optional (guest play keeps working); managed backend (Supabase: Postgres + Auth); scope includes progress & stats sync, profile & account deletion, global rarity scores, and leaderboards."

## Clarifications

### Session 2026-10-25

- Q: Same day played on two devices (one offline) — which result is kept? → A: First device wins
  (the session whose first guess reached the account first); the other device's game for that
  day is discarded and the player is told.
- Q: Whose finished games count toward rarity? → A: Signed-in players plus anonymous guest
  submissions, all validated server-side and rate-limited.
- Q: Which leaderboards? → A: Daily (score → rarity → time), weekly/monthly totals, and all-time.
- Q: Which sign-in methods ship first? → A: Email magic link only; Google and Discord stay as TODO.
- Q: Which email sender? → A: Supabase's built-in (development) mailer for now; custom SMTP later.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create an account and keep my progress (Priority: P1)

A player who has been playing as a guest decides to create an account. They choose "Sign in",
enter their email, open the one-time sign-in link (Google and Discord come later), and complete sign-in. Their existing local history
(past daily results) and today's in-progress game are attached to the new account, so nothing
is lost. From then on, every guess is saved to their account.

**Why this priority**: Saving progress is the reason accounts exist; without it nothing else in
this feature has value.

**Independent Test**: Play two daily games as a guest, sign in with a new account, and verify
history, statistics, and today's game are shown unchanged and are stored in the account.

**Acceptance Scenarios**:

1. **Given** a guest with local history, **When** they sign in for the first time, **Then** their
   local history and today's session are imported into the account and statistics are unchanged.
2. **Given** a signed-in player, **When** they submit a guess, **Then** the guess is saved to their
   account within a few seconds.
3. **Given** a signed-in player whose connection drops, **When** they keep playing, **Then** the game
   continues locally and the pending guesses are saved to the account once the connection returns.
4. **Given** a player on the sign-in screen, **When** they choose email, **Then** they receive a
   one-time sign-in link and are signed in after opening it on the same device.
5. **Given** a signed-in player, **When** they sign out, **Then** the device returns to guest mode
   and no account data remains readable on that device.

---

### User Story 2 - Continue on another device (Priority: P1)

A signed-in player starts today's grid on their phone and later opens Umagrid on a computer,
signed in to the same account. They see today's grid exactly as they left it, plus their full
history and statistics.

**Why this priority**: Cross-device continuity is the main user-visible benefit of an account.

**Independent Test**: Make 3 guesses on device A, sign in on device B, verify the same cells,
remaining guesses, and statistics.

**Acceptance Scenarios**:

1. **Given** a session in progress on device A, **When** the player opens the site signed in on
   device B, **Then** the same filled cells and remaining guesses are shown.
2. **Given** a finished daily game on device A, **When** the player opens device B the same day,
   **Then** the game is shown as finished and cannot be replayed.
3. **Given** the same day was played on two devices while one was offline, **When** both sync,
   **Then** the session that reached the account first is kept, the other device shows that
   session, and the player is told the other device's game for that day was discarded.

---

### User Story 3 - Manage my profile and data (Priority: P2)

A signed-in player can set a public display name, see the email they signed in with, download
a copy of their data, and permanently delete their account.

**Why this priority**: Required for privacy compliance and for leaderboards, but the game works
without it.

**Independent Test**: Change the display name, export data and check its content, delete the
account and verify the data is gone and sign-in creates a fresh account.

**Acceptance Scenarios**:

1. **Given** a signed-in player, **When** they set a display name that passes the rules in FR-016,
   **Then** it is saved and used wherever their name is public.
2. **Given** a signed-in player, **When** they request a data export, **Then** they receive a
   machine-readable file with their profile, game sessions, and history.
3. **Given** a signed-in player, **When** they confirm account deletion, **Then** their account,
   profile, sessions, history, and leaderboard entries are permanently removed, and their past
   answers remain only as anonymous counts inside rarity statistics.

---

### User Story 4 - See how rare my answers are (Priority: P2)

After finishing a daily grid, a player sees, for each of their correct answers, the percentage of
players who chose the same trainee version for that cell, plus a total rarity score (sum of the
percentages; lower is rarer), as in PokeDoku. This fills the "Rarity" slot reserved in the PoC.

**Why this priority**: Rarity is what makes grid games replayable and shareable, but it needs a
critical mass of players to be meaningful.

**Independent Test**: Have several test players finish the same grid with known answers and
verify each answer's percentage and the total score.

**Acceptance Scenarios**:

1. **Given** a finished daily game, **When** the results view opens, **Then** each correct cell shows
   the percentage of players who picked that trainee version for that cell.
2. **Given** a finished daily game, **When** the results view opens, **Then** a total rarity score is
   shown, where empty or wrong cells count as 100%.
3. **Given** the backend is unreachable, **When** the results view opens, **Then** the game still
   shows the score and answers, with rarity marked as unavailable.
4. **Given** a finished game, **When** the player shares, **Then** the share text includes the rarity
   score but still no character names.

---

### User Story 5 - Compare with other players on leaderboards (Priority: P3)

A signed-in player can open the daily, weekly, monthly, and all-time leaderboards and see the top
players ranked by the rules in FR-022, with their own position highlighted.

**Why this priority**: Adds competition but depends on accounts, rarity, and enough players.

**Independent Test**: Seed several accounts with finished games and verify ordering, display
names, and the player's own rank.

**Acceptance Scenarios**:

1. **Given** finished daily games from several accounts, **When** a player opens the leaderboard,
   **Then** entries are ordered by the ranking rule and show display name, score, and rarity.
2. **Given** a signed-in player who finished today, **When** they open the leaderboard, **Then** their
   own rank is shown even if outside the top list.
3. **Given** a player who opted out of leaderboards, **When** anyone views the leaderboard, **Then**
   that player does not appear.

---

### Edge Cases

- Sign-in link opened on a different device or browser than where it was requested.
- (Deferred with Google/Discord, FR-003) The same email is used with Google and with a magic link:
  both sign-ins reach the same account.
- A guest has local progress for today and the account already has a different session for today
  (played elsewhere): resolved by FR-012.
- Local storage is cleared while signed in: progress is restored from the account on next load.
- The player plays across 00:00 UTC while offline: the guesses still belong to the puzzle that was
  open when made.
- Display name that is offensive, impersonates staff, or duplicates another player's name.
- A tampered client submits guesses for cells it never saw, guesses after the game ended, or a
  "correct" flag that the rules do not support.
- Very low player counts: rarity percentages on a day with few players.
- Account deletion while a sync is pending on another device.
- Backend outage or rate limiting: gameplay continues locally for everyone.

## Requirements *(mandatory)*

### Functional Requirements

**Accounts & sign-in**

- **FR-001**: Players MUST be able to play every mode without an account (guest mode stays
  identical to the current PoC).
- **FR-002**: Players MUST be able to create an account and sign in with an email one-time link
  (magic link). TODO (deferred, not in this release): Google and Discord sign-in.
- **FR-003**: TODO (deferred with FR-002 providers): a Google or Discord sign-in whose verified
  email matches an existing account MUST reach that same account rather than creating a
  duplicate.
- **FR-004**: Players MUST be able to sign out; signing out MUST remove account data cached on the
  device and return to guest mode.
- **FR-005**: Sessions MUST stay signed in across visits until the player signs out or the session
  expires.

**Progress sync**

- **FR-006**: For signed-in players, each accepted guess and each finished/given-up game MUST be
  stored in the account.
- **FR-007**: On first sign-in on a device, local history and local daily sessions MUST be imported
  into the account without creating duplicates.
- **FR-008**: Opening the site signed in MUST show the account's daily session, history, and
  statistics (statistics keep the PoC definitions).
- **FR-009**: Gameplay MUST NOT wait for the backend; guesses are applied locally immediately and
  synced in the background, retrying until saved.
- **FR-010**: The backend MUST validate every stored guess with the same rules as the game engine
  (correct grid for that puzzle number, cell empty, trainee not already used, guess count ≤ 9,
  game not finished, correctness recomputed server-side) and reject invalid ones.
- **FR-011**: A daily puzzle MUST only accept guesses on or after its date (UTC); guesses for
  future puzzles MUST be rejected.
- **FR-012**: When local and account data disagree for the same puzzle, the first device wins: the
  account keeps the session whose first guess was stored first, guesses for that puzzle from
  any other device are rejected, and that other device replaces its local game with the
  account's session and tells the player the local game for that day was discarded.
- **FR-013**: Practice games MUST remain local only and MUST NOT be stored in the account.

**Profile & data**

- **FR-014**: Each account MUST have a display name; a default (e.g. "Trainer-1234") is assigned on
  creation.
- **FR-015**: Players MUST be able to change their display name.
- **FR-016**: Display names MUST be 3–20 characters, unique (case-insensitive), and MUST be
  rejected if they match a blocklist of offensive or reserved terms.
- **FR-017**: Players MUST be able to export their data (profile, sessions, history) as a
  machine-readable file.
- **FR-018**: Players MUST be able to permanently delete their account and all personal data; the
  deletion MUST complete within 30 days (immediately for in-app data) and MUST be confirmed
  explicitly.
- **FR-019**: Players MUST be able to opt out of appearing on leaderboards.

**Rarity**

- **FR-020**: For each daily puzzle and cell, the system MUST compute the percentage of eligible
  finished games whose correct answer in that cell is each trainee version. Eligible games are
  finished daily games of signed-in players plus finished daily games submitted anonymously by
  guests; every eligible game MUST pass the same server-side rule validation as FR-010, count
  at most once per account or guest device, and guest submissions MUST be rate-limited.
- **FR-021**: The results view MUST show per-cell percentages and a total rarity score (sum over the
  9 cells; empty/wrong cells count 100%; lower is better). Percentages MUST be shown only once
  the puzzle has at least 20 eligible finished games; otherwise "not enough players yet".

**Leaderboards**

- **FR-022**: Leaderboards MUST include only finished daily games of signed-in, non-opted-out
  players (guests never appear) and MUST offer:
  1. **Daily**: highest score, then lowest rarity score, then earliest finish time.
  2. **Weekly** (Monday–Sunday, UTC) and **Monthly** (calendar month, UTC): highest sum of daily
     scores in the period, then lowest sum of rarity scores, then more games played.
  3. **All-time**: highest sum of daily scores, then more perfect grids, then earlier account
     creation.
- **FR-023**: The leaderboard MUST show the top 100 entries plus the viewing player's own rank, with
  display name, score, and rarity score only.

**Non-functional**

- **FR-024**: All user-facing text for this feature MUST be externalized for i18n (English only).
- **FR-025**: Sign-in, profile, leaderboard, and rarity UI MUST meet the same accessibility bar as
  the game (keyboard, screen reader, WCAG 2.1 AA, 360 px).
- **FR-026**: The About/privacy page MUST describe what account data is stored, why, and how to
  export or delete it.

### Key Entities

- **Account**: An authenticated player identity; linked sign-in methods (email, Google, Discord).
- **Profile**: Public-facing player info: display name, leaderboard opt-out, created date.
- **Daily Session (cloud)**: A player's game for one puzzle number: guesses (cell, trainee version,
  correctness as validated by the backend, time), status, score. One per account per puzzle.
- **History Entry (cloud)**: Finished result per puzzle (score, status, rarity score).
- **Answer Statistic**: Aggregate count per puzzle, cell, and trainee version of eligible correct
  answers; plus the number of eligible finished games per puzzle. Contains no player identity.
- **Leaderboard Entry**: Derived ranking of a finished daily game for a public profile.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A guest can create an account and see their imported history in under 60 seconds
  (excluding time to open the sign-in email).
- **SC-002**: 99% of guesses made while online are stored in the account within 5 seconds.
- **SC-003**: 0 lost games already stored in the account across all sync/conflict end-to-end tests
  (including offline and two-device scenarios); discarded local games are always announced.
- **SC-004**: With the backend fully unavailable, 100% of gameplay flows (daily, practice, results
  without rarity) still work.
- **SC-005**: Automated tests prove that no player can read or change another player's private data
  and that 100% of invalid guesses in the test suite are rejected by the backend.
- **SC-006**: Account deletion removes 100% of the player's personal records (verified by test).
- **SC-007**: Rarity and leaderboard views load within 2 seconds for a puzzle with 10,000 finished
  games.
- **SC-008**: Operating cost stays within the backend provider's free tier for up to 1,000 daily
  active players.

## Assumptions

- Managed backend: Supabase (hosted Postgres + Auth + row-level security); the site stays a static
  export (constitution v2.0.0, Principle II).
- Email magic links are sent by the auth provider's built-in development mailer for now. It is
  heavily rate-limited and may only deliver to the project team's addresses, so a custom SMTP
  provider is REQUIRED before opening sign-up to the public (out of scope for this feature).
- Players must be at least 13 years old (stated in the privacy text); no age verification.
- Answers are public in the client bundle, so leaderboards cannot prevent players from looking up
  answers; validation only guarantees results follow the game rules.
- The PoC statistics definitions (played, average, perfect, streaks) are unchanged; for signed-in
  players they are computed from the account history.
- Rarity counts the trainee version chosen (not the character), consistent with answers being
  trainee versions.
- Deleted accounts' answers remain only as anonymous aggregate counts (no identity), which keeps
  past rarity stable.
- Leaderboards cover daily puzzles only; practice games never appear.
- On first sign-in, if the account already has a session for today that differs from the local
  one, the account's session is kept (it reached the account first, FR-012); past days with no
  account session are imported from local history.
- Guest rarity submissions are sent only when a guest finishes a daily game and are tied to an
  anonymous per-device identifier, not to any personal data.
- Production hosting is GitHub Pages (project site under a base path, e.g.
  `https://<user>.github.io/<repo>/`); the backend is the existing Supabase project.
- A daily game imported on first sign-in (even if it was still in progress and finished later
  online) does not count toward rarity, so a game is never counted twice; this slightly
  under-counts and is accepted.
