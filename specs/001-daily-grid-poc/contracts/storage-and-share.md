# Contract: Browser Storage & Share Text

## localStorage keys (prefix `umagrid:v1:`)

| Key | Value (JSON) | Written when |
|---|---|---|
| `umagrid:v1:daily:<puzzleNumber>` | `GameSession` | After every accepted guess / give up |
| `umagrid:v1:history` | `HistoryEntry[]` (sorted by `puzzleNumber`) | When a daily session reaches a terminal state |
| `umagrid:v1:settings` | `{ howToPlaySeen: boolean }` | On dismissing How to play |

Rules:
- Practice sessions are never persisted and never touch `history`.
- Unknown/corrupt values are ignored (treated as absent), never crash the app.
- Storage unavailable (private mode, quota) → in-memory fallback, game still playable.
- Daily sessions older than 30 puzzles may be pruned; `history` is kept.
- Changing a stored shape requires a new prefix (`v2`) plus a migration in `src/storage/local.ts`.

## Share text (FR-018)

Template strings come from `messages/en.json`; layout:

```text
Umagrid #<puzzleNumber> <score>/9
🟩🟩⬜
🟩🟩🟩
⬜🟩🟩
<site url>
```

- `🟩` = filled cell, `⬜` = empty cell. Row-major, 3 lines.
- MUST NOT include character names or category labels (spoiler-free).
- Copied with the Clipboard API; on failure, the text is shown in a selectable field.
- Practice share text uses `Umagrid Practice` and omits the puzzle number.

## Rarity slot (FR-010)

Results show a "Rarity" column per filled cell with a placeholder value ("—") and a tooltip
message key `results.rarityUnavailable`. No rarity is stored or computed in the PoC.
