import type { Character, LocalizedText, TraineeVersion } from "./types";

export function localize(text: LocalizedText, locale: string): string {
  return text[locale] ?? text.en;
}

export function displayName(
  trainee: TraineeVersion,
  character: Character,
  locale: string,
): string {
  const name = localize(character.name, locale);
  return trainee.isOriginal ? name : `${name} · ${localize(trainee.versionTag, locale)}`;
}
