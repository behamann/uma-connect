import { describe, expect, it } from "vitest";
import { shareText, type ShareStrings } from "@/game/share";
import type { GameSession } from "@/game/types";

const strings: ShareStrings = {
  daily: (n, s) => `Uma-connect #${n} ${s}/9`,
  practice: (s) => `Uma-connect Practice ${s}/9`,
};

const session: GameSession = {
  gridKey: "daily:12",
  cells: ["100101", "100201", null, "100301", "100401", "100501", null, "100601", "100701"],
  guesses: [],
  status: "out_of_guesses",
};

describe("shareText", () => {
  it("renders the daily layout row-major", () => {
    expect(shareText(session, 12, "https://uma-connect.example", strings)).toBe(
      ["Uma-connect #12 7/9", "🟩🟩⬜", "🟩🟩🟩", "⬜🟩🟩", "https://uma-connect.example"].join("\n"),
    );
  });

  it("contains no trainee IDs or names", () => {
    const text = shareText(session, 12, "https://uma-connect.example", strings);
    for (const id of session.cells) if (id) expect(text).not.toContain(id);
  });

  it("omits the puzzle number in practice mode", () => {
    const text = shareText(session, null, "https://uma-connect.example", strings);
    expect(text.split("\n")[0]).toBe("Uma-connect Practice 7/9");
    expect(text).not.toContain("#");
  });

  it("adds the rarity score after the header when available", () => {
    const withRarity = { ...strings, rarity: (r: number) => `Rarity: ${r}` };
    const lines = shareText(session, 12, "https://uma-connect.example", withRarity, 123).split("\n");
    expect(lines.slice(0, 3)).toEqual(["Uma-connect #12 7/9", "Rarity: 123", "🟩🟩⬜"]);
    expect(shareText(session, 12, "https://uma-connect.example", withRarity, null)).not.toContain("Rarity");
  });
});
