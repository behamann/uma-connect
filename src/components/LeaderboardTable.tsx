"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { Leaderboard, LeaderboardEntry, LeaderboardPeriod } from "@/backend/public";

const isMe = (entry: LeaderboardEntry, me: LeaderboardEntry | null) =>
  !!me && entry.rank === me.rank && entry.display_name === me.display_name;

function Row({ entry, me }: { entry: LeaderboardEntry; me: boolean }) {
  const t = useTranslations("leaderboard");
  return (
    <tr
      aria-current={me ? "true" : undefined}
      data-testid="leaderboard-row"
      className={me ? "bg-brand/10 font-semibold" : "even:bg-slate-50"}
    >
      <td className="px-3 py-1.5 text-right tabular-nums">{entry.rank}</td>
      <th scope="row" className="px-3 py-1.5 text-left font-medium">
        {entry.display_name}
        {me && <span className="ml-1 text-sm text-brand-dark">{t("you")}</span>}
      </th>
      <td className="px-3 py-1.5 text-right tabular-nums">{entry.score}</td>
      <td className="px-3 py-1.5 text-right tabular-nums">{entry.rarity}</td>
    </tr>
  );
}

export function LeaderboardTable({
  period,
  caption,
  data,
  fetchedAt,
}: {
  period: LeaderboardPeriod;
  caption: string;
  data: Leaderboard;
  fetchedAt: number;
}) {
  const t = useTranslations("leaderboard");
  const format = useFormatter();
  const meListed = data.entries.some((e) => isMe(e, data.me));

  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
      <table className="w-full text-sm">
        <caption className="px-3 pt-3 text-left">
          <span className="block font-semibold">{caption}</span>
          <span className="block text-xs text-slate-600">{t(`rules.${period}`)}</span>
          {period !== "daily" && data.updated_at && (
            <span className="block text-xs text-slate-600" data-testid="leaderboard-updated">
              {t("updated", { time: format.relativeTime(new Date(data.updated_at), fetchedAt) })}
            </span>
          )}
        </caption>
        <thead>
          <tr className="border-b border-slate-200 text-slate-600">
            <th scope="col" className="px-3 py-2 text-right font-medium">
              {t("rank")}
            </th>
            <th scope="col" className="px-3 py-2 text-left font-medium">
              {t("player")}
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              {t("score")}
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              {t("rarity")}
            </th>
          </tr>
        </thead>
        <tbody>
          {data.entries.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-3 py-6 text-center text-slate-600">
                {t("empty")}
              </td>
            </tr>
          ) : (
            data.entries.map((entry) => (
              <Row key={`${entry.rank}-${entry.display_name}`} entry={entry} me={isMe(entry, data.me)} />
            ))
          )}
        </tbody>
        {data.me && !meListed && (
          <tbody className="border-t-2 border-slate-200">
            <Row entry={data.me} me />
          </tbody>
        )}
      </table>
    </div>
  );
}
