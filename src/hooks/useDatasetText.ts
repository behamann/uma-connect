"use client";

import { useLocale } from "next-intl";
import { useCallback, useMemo } from "react";
import { dataset } from "@/game/data";
import { buildSearchIndex, type SearchIndex } from "@/game/search";
import { displayName, localize } from "@/game/text";
import type { CategoryId, TraineeId } from "@/game/types";

export interface TraineeView {
  id: TraineeId;
  name: string;
  displayName: string;
  version: string | null;
  portrait: string | null;
}

// Derived once per locale and shared by every component (the dataset never changes at runtime).
const viewsByLocale = new Map<string, Map<TraineeId, TraineeView>>();
const indexByLocale = new Map<string, SearchIndex>();

function traineeViews(locale: string): Map<TraineeId, TraineeView> {
  let views = viewsByLocale.get(locale);
  if (!views) {
    views = new Map();
    for (const t of dataset.trainees.values()) {
      const c = dataset.characters.get(t.characterId);
      if (!c) continue;
      views.set(t.id, {
        id: t.id,
        name: localize(c.name, locale),
        displayName: displayName(t, c, locale),
        version: t.isOriginal ? null : localize(t.versionTag, locale),
        portrait: t.portrait,
      });
    }
    viewsByLocale.set(locale, views);
  }
  return views;
}

export function searchIndexFor(locale: string): SearchIndex {
  let index = indexByLocale.get(locale);
  if (!index) {
    index = buildSearchIndex(dataset, locale);
    indexByLocale.set(locale, index);
  }
  return index;
}

export function useTraineeLookup() {
  const views = traineeViews(useLocale());
  return useCallback((id: TraineeId): TraineeView | undefined => views.get(id), [views]);
}

export function useCategoryText() {
  const locale = useLocale();
  return useMemo(
    () => (id: CategoryId) => {
      const cat = dataset.categories.get(id);
      return {
        label: cat ? localize(cat.label, locale) : id,
        rule: cat ? localize(cat.rule, locale) : "",
      };
    },
    [locale],
  );
}
