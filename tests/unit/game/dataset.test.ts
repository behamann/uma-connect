import { describe, expect, it } from "vitest";
import { DataValidationError, loadDataset, loadSchedule } from "@/game/dataset";
import { char, fixtureRaw, trainee } from "../../fixtures/dataset";

function expectInvalid(raw: ReturnType<typeof fixtureRaw>, fragment: string) {
  try {
    loadDataset(raw);
  } catch (e) {
    expect(e).toBeInstanceOf(DataValidationError);
    expect((e as DataValidationError).problems.join("\n")).toContain(fragment);
    return;
  }
  throw new Error("expected loadDataset to throw");
}

describe("loadDataset", () => {
  it("loads a valid dataset into maps", () => {
    const ds = loadDataset(fixtureRaw());
    expect(ds.characters.size).toBe(12);
    expect(ds.trainees.size).toBe(13);
    expect(ds.categories.get("turf-a")?.groupId).toBe("track");
  });

  it("rejects duplicate IDs", () => {
    const raw = fixtureRaw();
    raw.characters.characters.push(char(1));
    expectInvalid(raw, 'duplicate id "c1"');
  });

  it("rejects trainees referencing unknown characters", () => {
    const raw = fixtureRaw();
    raw.trainees.trainees.push(trainee("tx", "c99"));
    expectInvalid(raw, 'unknown character "c99"');
  });

  it("requires exactly one original trainee per character", () => {
    const raw = fixtureRaw();
    raw.trainees.trainees.push(trainee("t1b", "c1", { isOriginal: true }));
    expectInvalid(raw, '"c1" must have exactly one original trainee (has 2)');
  });

  it("requires an English text", () => {
    const raw = fixtureRaw();
    raw.characters.characters[0] = char(1, { name: { ja: "名前" } });
    expectInvalid(raw, "characters: characters.0.name.en");
  });

  it("requires source URLs", () => {
    const raw = fixtureRaw();
    raw.characters.characters[0] = char(1, { sources: { profile: "not a url", irl: "x" } });
    expectInvalid(raw, "sources.profile");
  });

  it("rejects non-empty server lists and bad birthdays", () => {
    const raw = fixtureRaw();
    raw.trainees.trainees[0] = { ...trainee("t1", "c1"), servers: [] };
    raw.characters.characters[1] = char(2, { birthday: { month: 13, day: 1 } });
    expectInvalid(raw, "servers");
  });

  it("rejects unknown dorms", () => {
    const raw = fixtureRaw();
    raw.characters.characters[0] = char(1, { dorm: "nowhere" });
    expectInvalid(raw, "dorm");
  });

  it("rejects aptitude keys on the wrong axis", () => {
    const raw = fixtureRaw();
    (raw.categories.categories as Record<string, unknown>[]).push({
      id: "bad",
      groupId: "track",
      label: { en: "bad" },
      rule: { en: "bad" },
      match: { type: "aptitude", axis: "track", key: "long", min: "A" },
      enabled: true,
    });
    expectInvalid(raw, 'aptitude key "long" is not on axis "track"');
  });
});

describe("loadSchedule", () => {
  it("parses a valid schedule", () => {
    const s = loadSchedule({
      launchDate: "2026-11-01",
      puzzles: [{ puzzleNumber: 1, date: "2026-11-01", rows: ["a", "b", "c"], cols: ["d", "e", "f"] }],
    });
    expect(s.puzzles).toHaveLength(1);
  });

  it("rejects malformed entries", () => {
    expect(() => loadSchedule({ launchDate: "11/01/2026", puzzles: [] })).toThrow(DataValidationError);
    expect(() =>
      loadSchedule({ launchDate: "2026-11-01", puzzles: [{ puzzleNumber: 1, date: "2026-11-01", rows: ["a"], cols: [] }] }),
    ).toThrow(DataValidationError);
  });
});
