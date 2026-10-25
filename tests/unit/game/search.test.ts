import { describe, expect, it } from "vitest";
import { loadDataset } from "@/game/dataset";
import { buildSearchIndex, normalize, search } from "@/game/search";
import { char, categoriesRaw, trainee } from "../../fixtures/dataset";

const ds = loadDataset({
  characters: {
    characters: [
      char(1, { id: "hokko-tarumae", name: { en: "Hokko Tarumae" }, aliases: ["ホッコータルマエ", "Hokkō Tarumae"] }),
      char(2, { id: "special-week", name: { en: "Special Week" } }),
      char(3, { id: "silence-suzuka", name: { en: "Silence Suzuka" } }),
      char(4, { id: "seiun-sky", name: { en: "Seiun Sky" } }),
    ],
  },
  trainees: {
    trainees: [
      trainee("109901", "hokko-tarumae"),
      trainee("100101", "special-week"),
      { ...trainee("100102", "special-week", { isOriginal: false }), versionTag: { en: "Summer" } },
      trainee("100201", "silence-suzuka"),
      trainee("100301", "seiun-sky"),
    ],
  },
  categories: categoriesRaw(),
});
const index = buildSearchIndex(ds, "en");

describe("normalize", () => {
  it("strips case, diacritics, and punctuation", () => {
    expect(normalize("HOKKO-TARUMAE")).toBe("hokko tarumae");
    expect(normalize("Hokkō")).toBe("hokko");
  });
});

describe("search", () => {
  it("is case, diacritic, and punctuation insensitive", () => {
    for (const q of ["hokko", "Hokkō", "HOKKO-TARUMAE", "  tarumae "]) {
      expect(search(index, q)[0], q).toBe("109901");
    }
  });

  it("matches multiple token prefixes", () => {
    expect(search(index, "spe week")).toEqual(["100101", "100102"]);
  });

  it("matches Japanese aliases", () => {
    expect(search(index, "ホッコー")).toEqual(["109901"]);
  });

  it("matches version tags", () => {
    expect(search(index, "special summer")).toEqual(["100102"]);
  });

  it("ranks name prefixes before substrings and lists the original version first", () => {
    expect(search(index, "s")).toEqual(["100301", "100201", "100101", "100102"]);
    expect(search(index, "uzuka")).toEqual(["100201"]);
  });

  it("respects the limit and returns nothing for empty queries", () => {
    expect(search(index, "s", 2)).toHaveLength(2);
    expect(search(index, "  ")).toEqual([]);
    expect(search(index, "zzz")).toEqual([]);
  });
});
