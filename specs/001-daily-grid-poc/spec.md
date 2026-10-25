# Feature Specification: Umagrid Daily Grid (Frontend PoC)

**Feature Branch**: `001-daily-grid-poc`

**Created**: 2026-10-25

**Status**: Draft

**Input**: User description: "A browser game similar to PokeDoku (fill a 3x3 grid with values matching row and column categories), themed on Umamusume: Pretty Derby characters instead of Pokémon. Frontend-only proof of concept, English only but ready for future internationalization. Character data comes from public references (e.g. GameTora, Umamusume wikis); the set of categorized attributes must be defined to make the game playable."

## Clarifications

### Session 2026-10-25

- Q: Which characters can be used as answers? → A: All Umamusume playable as trainees on any
  server (JP + Global).
- Q: How does scoring work without a backend? → A: Score = correct cells (0–9); the UI reserves a
  slot for a future rarity % that is unavailable in the PoC.
- Q: Which category groups form the initial catalog? → A: Track aptitude, Distance aptitude,
  Running style aptitude, Dorm, Birthday, Real-life G1 wins, Triple Crown/Tiara, Sire line,
  Birth decade/coat color.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Play today's grid (Priority: P1)

A player opens Umagrid and sees today's 3x3 grid: three category labels across the top
(columns) and three down the side (rows). The player selects an empty cell, types part of an
Umamusume's name, picks a suggestion, and the guess is checked against both the cell's row
and column categories. A correct guess locks the character (name and portrait) into the cell;
an incorrect guess leaves the cell empty but still consumes one of the 9 guesses. A character
already placed on the grid cannot be used again. The game ends when all 9 cells are filled or
all 9 guesses are spent.

**Why this priority**: This is the entire core gameplay loop; without it there is no product.

**Independent Test**: Load the site on a given date, fill cells with known valid and invalid
answers, and verify cells lock, guesses decrement, reuse is rejected, and the game ends
correctly.

**Acceptance Scenarios**:

1. **Given** a new daily grid, **When** the player opens the site, **Then** 6 category labels,
   9 empty cells, and a remaining-guesses counter of 9 are shown.
2. **Given** an empty cell, **When** the player picks a character that satisfies both the row and
   column categories, **Then** the cell shows that character, becomes locked, and remaining
   guesses decrease by 1.
3. **Given** an empty cell, **When** the player picks a character that fails either category,
   **Then** the cell stays empty, the player is told the guess was wrong, and remaining guesses
   decrease by 1.
4. **Given** a character already placed in another cell, **When** the player searches for it,
   **Then** it is shown as unavailable and cannot be submitted (no guess is consumed).
5. **Given** 1 remaining guess, **When** the player submits a guess, **Then** the game ends and
   the results view is shown.
6. **Given** a game in progress, **When** the player chooses "Give up" and confirms, **Then** the
   game ends with the current state and the results view is shown.

---

### User Story 2 - Resume and finish the daily game (Priority: P1)

A player who closes the browser mid-game returns later the same day and finds the grid exactly
as they left it. After finishing, revisiting the site that day shows the completed grid and
results instead of a fresh game. At the next daily reset a new grid is available.

**Why this priority**: A daily puzzle is only credible if progress cannot be lost or replayed.

**Independent Test**: Play 3 guesses, reload the page, verify state; finish the game, reload,
verify the results view; advance the date, verify a new grid.

**Acceptance Scenarios**:

1. **Given** a partially played daily grid, **When** the player reloads the page on the same day,
   **Then** filled cells, remaining guesses, and wrong-guess history are restored.
2. **Given** a finished daily grid, **When** the player reopens the site the same day, **Then**
   the results view for that grid is shown and no new guesses are accepted.
3. **Given** two players on different devices on the same day, **When** both open the site,
   **Then** both see the identical grid.
4. **Given** the daily reset time has passed, **When** the player opens the site, **Then** a new
   grid is shown and a countdown to the next reset is visible on the results view.

---

### User Story 3 - Review results and share (Priority: P2)

When the game ends, the player sees their score, the filled grid, and for every cell the list of
all valid answers (so they learn characters they did not know). The player can copy a
spoiler-free text summary (an emoji grid plus puzzle number and score) to share on social
media.

**Why this priority**: Learning and sharing drive the daily-return habit and organic growth, but
the game is playable without them.

**Independent Test**: Finish a game and verify the results content and the copied share text.

**Acceptance Scenarios**:

1. **Given** a finished game, **When** the results view opens, **Then** it shows the score, the
   player's grid, and each cell's full list of valid answers.
2. **Given** a finished game, **When** the player presses "Share", **Then** a text containing the
   game name, puzzle number, score, and a 3x3 emoji grid (correct vs. empty) is copied to the
   clipboard and contains no character names.

---

### User Story 4 - Understand the rules and categories (Priority: P2)

A first-time player sees a "How to play" explanation of the rules. At any time a player can
open a category label to read its exact membership rule (e.g. what counts as "Long ≥ A").

**Why this priority**: Category disputes are the main source of frustration in grid games;
explicit rules prevent it.

**Independent Test**: Open the site with no stored data and verify the rules dialog appears; tap
any category and verify its rule text.

**Acceptance Scenarios**:

1. **Given** a first visit, **When** the site loads, **Then** a "How to play" dialog is shown and
   can be dismissed and reopened later.
2. **Given** any category label, **When** the player activates it, **Then** its rule description
   is displayed.

---

### User Story 5 - Personal statistics (Priority: P3)

The player can view their own statistics stored on the device: games played, average correct
cells, perfect grids (9/9), current and best daily streak.

**Why this priority**: Nice retention feature, not needed to validate the concept.

**Independent Test**: Complete games on consecutive simulated days and verify the stats.

**Acceptance Scenarios**:

1. **Given** finished games on 3 consecutive days, **When** the player opens Statistics, **Then**
   games played = 3 and current streak = 3.
2. **Given** a missed day, **When** the player finishes the next daily game, **Then** current streak
   resets to 1 and best streak is preserved.

---

### User Story 6 - Practice mode (Priority: P3)

Besides the daily grid, a player can start an unlimited "Practice" grid generated on demand,
which does not affect daily progress or statistics.

**Why this priority**: Extends play time and helps validate grid generation, but optional for the
PoC.

**Independent Test**: Start several practice grids and verify they are valid and independent from
the daily game state.

**Acceptance Scenarios**:

1. **Given** any state of the daily game, **When** the player starts a practice grid, **Then** a new
   valid grid is shown and the daily game state is unchanged.

---

### Edge Cases

- A character matches the cell but was already used elsewhere: it must not be submittable and
  must not consume a guess.
- The player types a name with different spacing, casing, punctuation, or an alternate
  romanization (e.g. "Hokkō" vs "Hokko"): search must still find the character.
- The player tries to submit free text that is not a known character: submission is not
  possible; only listed characters can be chosen.
- Same character with multiple in-game variants (e.g. alternate outfits): the character is one
  answer; variants are not separate answers.
- Daily reset happens while the page is open: the current game remains playable until reload;
  after reload the new grid is shown.
- Browser storage is unavailable or cleared: the game is still playable, progress simply is not
  persisted, and the player is not blocked.
- Device clock is wrong: the grid shown follows the device's date; this is accepted for the PoC.
- No grid scheduled / dataset error for today: a friendly error is shown instead of a broken grid.

## Requirements *(mandatory)*

### Functional Requirements

**Grid & gameplay**

- **FR-001**: The system MUST present a 3x3 grid with 3 row categories and 3 column categories.
- **FR-002**: The system MUST allow the player to select any empty cell and choose a character
  through a type-ahead search over the full character roster.
- **FR-003**: Search MUST be case-, accent-, and punctuation-insensitive and MUST also match
  known alternate names/romanizations.
- **FR-004**: The system MUST NOT reveal, in search results, whether a character is valid for the
  selected cell.
- **FR-005**: A guess MUST be correct only if the character satisfies both the row and the column
  category of the cell.
- **FR-006**: Each submitted guess (correct or not) MUST consume one of exactly 9 guesses.
- **FR-007**: A character placed on the grid MUST NOT be usable again in the same grid; such
  characters MUST appear as unavailable and MUST NOT consume a guess.
- **FR-008**: Correct cells MUST lock and display the character's name and portrait.
- **FR-009**: The game MUST end when all cells are filled, when guesses reach 0, or when the
  player confirms "Give up".
- **FR-010**: The score MUST be the number of correctly filled cells (0–9). The results view MUST
  reserve a visible slot for a per-answer rarity value that is shown as unavailable in the PoC
  and can be enabled once shared answer statistics exist.

**Daily puzzle**

- **FR-011**: All players MUST receive the same daily grid for a given calendar date, without
  requiring a server.
- **FR-012**: The daily grid MUST change at 00:00 UTC, and each daily grid MUST have a sequential
  puzzle number.
- **FR-013**: Every grid (daily or practice) MUST have at least 3 valid answers per cell and MUST
  be completable with 9 distinct characters.
- **FR-014**: The same combination of 6 categories MUST NOT repeat as a daily grid within 90 days.

**Persistence & results**

- **FR-015**: Daily game progress MUST persist on the device and be restored on reload the same
  day.
- **FR-016**: A finished daily game MUST NOT be replayable that day.
- **FR-017**: After the game ends, the system MUST show the score, the player's grid, every cell's
  full list of valid answers, and a countdown to the next daily grid.
- **FR-018**: The system MUST provide a "Share" action that copies a spoiler-free text summary
  (game name, puzzle number, score, emoji grid).
- **FR-019**: The system MUST keep per-device statistics: games played, average correct cells,
  perfect grids, current streak, best streak.
- **FR-020**: The system MUST offer a Practice mode that generates new valid grids on demand
  without affecting daily progress or statistics.

**Rules, content & data**

- **FR-021**: The system MUST show a "How to play" dialog on first visit and allow reopening it.
- **FR-022**: Every category MUST have a player-visible rule description.
- **FR-023**: The character roster MUST include every Umamusume released as a playable trainee
  on any server (Japanese or Global), and only those. Characters that exist only as support
  cards, NPCs, or in other media are excluded.
- **FR-024**: Categories MUST be drawn from an approved category catalog with at least 25
  individual categories. The initial catalog consists of these category groups:
  1. **Track aptitude** — Turf ≥ A, Dirt ≥ A.
  2. **Distance aptitude** — Sprint ≥ A, Mile ≥ A, Medium ≥ A, Long ≥ A.
  3. **Running style aptitude** — Front Runner ≥ A, Pace Chaser ≥ A, Late Surger ≥ A,
     End Closer ≥ A.
  4. **Dorm** — Ritto, Miho.
  5. **Birthday** — birth month (Jan–Dec) or season (Spring/Summer/Autumn/Winter).
  6. **Real-life G1 wins** — won a specific G1 race (e.g. Arima Kinen, Japan Cup, Tokyo Yushun
     (Japanese Derby), Tenno Sho (Spring/Autumn), Takarazuka Kinen, Satsuki Sho, Kikuka Sho), or
     won N+ G1 races.
  7. **Real-life titles** — Triple Crown winner, Triple Tiara winner (including partial: won at
     least one Classic race).
  8. **Real horse sire line** — descends in the male line from e.g. Sunday Silence,
     Mr. Prospector, Northern Dancer, Roberto.
  9. **Real horse profile** — birth decade (e.g. 1980s, 1990s, 2000s, 2010s), coat color.
- **FR-024a**: Two categories from the same group MUST NOT appear on the same axis pair if no
  character can satisfy both (e.g. Ritto × Miho), and a grid MUST use at least 4 different
  category groups.
- **FR-025**: Each character data point used by a category MUST record the reference source it
  was taken from.
- **FR-026**: The site MUST display an unofficial fan-project notice crediting Cygames, Inc. as
  rights holder, and credit data/image sources.

**Language & accessibility**

- **FR-027**: All user-facing text MUST be in English and MUST be externalized so additional
  languages can be added without changing game behavior.
- **FR-028**: The game MUST be fully playable with keyboard only and with a screen reader
  (cell state and guess results announced).
- **FR-029**: The game MUST be fully playable on mobile screens 360px wide and up.

### Key Entities

- **Character**: An Umamusume in the roster. Attributes: stable ID, display name (per locale),
  alternate names for search, portrait image, and the attribute values used by categories
  (e.g. aptitudes, dorm, birthday, real-horse facts), each with its source reference.
- **Category Group**: A family of related categories (e.g. "Distance Aptitude", "Dorm",
  "Real-life G1 wins"). Used to keep a grid varied and to avoid contradictory pairs.
- **Category**: A single row/column label with a locale-aware label, a rule description, and a
  membership rule that determines which characters qualify.
- **Grid (Puzzle)**: 3 row categories + 3 column categories, a puzzle number (daily) or practice
  flag, and the precomputed set of valid characters per cell.
- **Game Session**: A player's attempt at a grid: placed characters per cell, wrong guesses,
  remaining guesses, status (in progress / finished / gave up), score.
- **Player Statistics**: Per-device aggregate of daily sessions (played, average, perfect,
  streaks).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time player can understand the rules and submit their first guess within
  60 seconds of opening the site.
- **SC-002**: A full game (9 guesses) can be completed in under 5 minutes by a player who knows
  the answers.
- **SC-003**: 100% of published daily grids for the first 90 days pass the solvability check
  (≥ 3 answers per cell, completable with distinct characters).
- **SC-004**: Search returns the intended character within the top 5 suggestions for 95% of
  queries of 3 or more characters, including alternate spellings.
- **SC-005**: Reloading the page never loses a submitted guess (0 lost guesses across all
  end-to-end test runs).
- **SC-006**: Zero category-rule disputes in playtesting are caused by an undocumented rule
  (every disputed answer can be resolved by the displayed rule text).
- **SC-007**: The grid becomes interactive within 2 seconds on a mid-range phone over a typical
  4G connection.
- **SC-008**: In a playtest with at least 5 Umamusume players, at least 80% rate the grids as
  "fair" and want to play the next day.

## Assumptions

- Target players are English-speaking fans of Umamusume: Pretty Derby who know the characters.
- Frontend-only PoC: no accounts, no server, no global answer statistics; all player data stays
  on the device.
- The daily grid is determined by the device's calendar date in UTC.
- Daily grids are pre-generated and validated ahead of time; practice grids are generated on
  demand using the same validation rules.
- Each character is a single answer regardless of how many in-game outfits/versions it has;
  outfit-specific attributes (e.g. aptitudes) use the character's original/base version unless a
  category rule states otherwise.
- Character data is compiled manually or semi-automatically from public references
  (GameTora, umamusu.wiki, Umamusume fandom wiki) and stored with the site; the game does not
  call those sites at runtime.
- Portrait images are used under a fan-project notice; if an image is unavailable, the name alone
  is shown.
- Wrong guesses are not revealed to other cells (a wrong character can still be tried in another
  cell later).
- Aptitude grades follow the in-game scale (S, A, B, … G); "≥ A" means A or S.
- Real-horse facts (G1 wins, sire line, birth year, coat color) refer to the real racehorse the
  character is named after; Birthday refers to the character's official profile birthday.
- Since the roster includes JP-only trainees, English names for those characters follow the
  most common community romanization when no official English name exists.
