import { score } from "./session";
import type { GameSession } from "./types";

export interface ShareStrings {
  daily: (puzzleNumber: number, score: number) => string;
  practice: (score: number) => string;
}

/** Spoiler-free summary: header, 3×3 emoji grid, site URL. No names or category labels. */
export function shareText(
  s: GameSession,
  puzzleNumber: number | null,
  url: string,
  t: ShareStrings,
): string {
  const header = puzzleNumber === null ? t.practice(score(s)) : t.daily(puzzleNumber, score(s));
  const rows = [0, 1, 2].map((r) =>
    s.cells
      .slice(r * 3, r * 3 + 3)
      .map((c) => (c === null ? "⬜" : "🟩"))
      .join(""),
  );
  return [header, ...rows, url].join("\n");
}
