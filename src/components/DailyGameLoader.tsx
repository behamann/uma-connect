"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import DailyGame from "./DailyGame";
import PracticeGame from "./PracticeGame";

function Loading() {
  const t = useTranslations("common");
  return <p className="py-10 text-center text-slate-600">{t("loading")}</p>;
}

const subscribe = () => () => {};

/** True only in the browser; the games depend on the player's clock and local storage. */
function useIsClient() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

// Statically imported (not next/dynamic) so the game code downloads with the page instead of after hydration.
export function DailyGameLoader() {
  return useIsClient() ? <DailyGame /> : <Loading />;
}

export function PracticeGameLoader() {
  return useIsClient() ? <PracticeGame /> : <Loading />;
}
