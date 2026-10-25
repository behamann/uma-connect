"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { schedule } from "@/game/data";
import { puzzleNumberFor } from "@/game/daily";
import { computeStats } from "@/game/stats";
import type { PlayerStatistics } from "@/game/types";
import { getStorage } from "@/hooks/useGame";
import { useAuth } from "@/hooks/useAuth";
import { readHistory, SETTINGS_KEY } from "@/storage/local";
import { AccountMenu } from "./AccountMenu";
import { HowToPlayDialog } from "./HowToPlayDialog";
import { StatsDialog } from "./StatsDialog";

interface Settings {
  howToPlaySeen?: boolean;
}

/** Client-only (rendered inside ssr:false trees): reads settings and history from storage. */
export function AppHeader({ active }: { active?: "daily" | "practice" }) {
  const t = useTranslations("nav");
  const storage = getStorage();
  const auth = useAuth();
  const [howToOpen, setHowToOpen] = useState(
    () => !storage.get<Settings>(SETTINGS_KEY)?.howToPlaySeen,
  );
  const [stats, setStats] = useState<PlayerStatistics | null>(null);

  const closeHowTo = () => {
    setHowToOpen(false);
    storage.set(SETTINGS_KEY, { ...storage.get<Settings>(SETTINGS_KEY), howToPlaySeen: true });
  };

  const openStats = () =>
    setStats(computeStats(readHistory(storage), puzzleNumberFor(new Date(), schedule.launchDate)));

  const tab = (href: string, key: "daily" | "practice") => (
    <Link
      href={href}
      aria-current={active === key ? "page" : undefined}
      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
        active === key ? "bg-brand text-white" : "text-slate-700 hover:bg-white"
      }`}
    >
      {t(key)}
    </Link>
  );

  return (
    <nav aria-label={t("label")} className="flex items-center justify-between gap-2">
      <div className="flex gap-1">
        {tab("/", "daily")}
        {tab("/practice", "practice")}
      </div>
      <div className="flex flex-wrap justify-end gap-1">
        <button
          type="button"
          onClick={() => setHowToOpen(true)}
          className="rounded-md px-3 py-1.5 text-sm hover:bg-white"
        >
          {t("howToPlay")}
        </button>
        <button
          type="button"
          onClick={openStats}
          className="rounded-md px-3 py-1.5 text-sm hover:bg-white"
        >
          {t("stats")}
        </button>
        <AccountMenu />
      </div>
      <HowToPlayDialog open={howToOpen} onClose={closeHowTo} />
      {stats && (
        <StatsDialog
          open
          onClose={() => setStats(null)}
          stats={stats}
          synced={auth.status === "signed-in"}
        />
      )}
    </nav>
  );
}
