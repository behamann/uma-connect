"use client";

import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";
import { backendEnabled } from "@/backend/config";
import type { LeaderboardPeriod } from "@/backend/public";
import { schedule } from "@/game/data";
import { periodKeys, puzzleNumberFor } from "@/game/daily";
import { useAuth } from "@/hooks/useAuth";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { AppHeader } from "./AppHeader";
import { LeaderboardTable } from "./LeaderboardTable";

const PERIODS: LeaderboardPeriod[] = ["daily", "week", "month", "all"];
const subscribe = () => () => {};

function Board({ period, periodKey, caption }: { period: LeaderboardPeriod; periodKey: string; caption: string }) {
  const t = useTranslations("leaderboard");
  const state = useLeaderboard(period, periodKey);
  if (state.status === "loading") return <p className="py-6 text-center text-slate-600">{t("loading")}</p>;
  if (state.status === "unavailable") {
    return (
      <p role="alert" className="py-6 text-center text-red-700">
        {t("unavailable")}
      </p>
    );
  }
  return <LeaderboardTable period={period} caption={caption} data={state.data} fetchedAt={state.fetchedAt} />;
}

/** Period keys depend on the player's clock, so this only renders in the browser. */
function Boards() {
  const t = useTranslations("leaderboard");
  const format = useFormatter();
  const auth = useAuth();
  const [now] = useState(() => new Date());
  const puzzle = puzzleNumberFor(now, schedule.launchDate);
  const { week, month } = periodKeys(now);
  const keys: Record<LeaderboardPeriod, string> = { daily: String(puzzle), week, month, all: "all" };
  const captions: Record<LeaderboardPeriod, string> = {
    daily: t("caption.daily", { number: puzzle }),
    week: t("caption.week", { week }),
    month: t("caption.month", { month: format.dateTime(now, { month: "long", year: "numeric", timeZone: "UTC" }) }),
    all: t("caption.all"),
  };

  return (
    <>
      {auth.status === "guest" && <p className="text-sm text-slate-600">{t("joinPrompt")}</p>}
      <TabGroup>
        <TabList aria-label={t("tabs")} className="flex gap-1 rounded-lg bg-slate-200 p-1">
          {PERIODS.map((p) => (
            <Tab
              key={p}
              className="flex-1 rounded-md px-2 py-1.5 text-sm font-medium text-slate-700 data-hover:bg-white/60 data-selected:bg-white data-selected:text-brand-dark data-selected:shadow-sm"
            >
              {t(`period.${p}`)}
            </Tab>
          ))}
        </TabList>
        <TabPanels className="mt-3">
          {PERIODS.map((p) => (
            <TabPanel key={p}>
              <Board period={p} periodKey={keys[p]} caption={captions[p]} />
            </TabPanel>
          ))}
        </TabPanels>
      </TabGroup>
    </>
  );
}

export function LeaderboardPage() {
  const t = useTranslations("leaderboard");
  const isClient = useSyncExternalStore(subscribe, () => true, () => false);

  return (
    <div className="flex flex-col gap-3">
      {isClient && <AppHeader active="leaderboard" />}
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      {!isClient ? (
        <p className="text-center text-slate-600">{t("loading")}</p>
      ) : backendEnabled ? (
        <Boards />
      ) : (
        <p className="text-center text-slate-600">{t("disabled")}</p>
      )}
    </div>
  );
}
