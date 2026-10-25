"use client";

import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { useFormatter, useTranslations } from "next-intl";
import type { PlayerStatistics } from "@/game/types";

export function StatsDialog({
  open,
  onClose,
  stats,
  synced = false,
}: {
  open: boolean;
  onClose: () => void;
  stats: PlayerStatistics;
  synced?: boolean;
}) {
  const t = useTranslations("stats");
  const format = useFormatter();
  const items = [
    { key: "played", value: format.number(stats.played) },
    { key: "average", value: format.number(stats.averageScore, { maximumFractionDigits: 1 }) },
    { key: "perfect", value: format.number(stats.perfect) },
    { key: "currentStreak", value: format.number(stats.currentStreak) },
    { key: "bestStreak", value: format.number(stats.bestStreak) },
  ] as const;

  return (
    <Dialog open={open} onClose={onClose} className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div className="fixed inset-0 flex items-start justify-center p-3 pt-[10vh]">
        <DialogPanel className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
          <DialogTitle className="text-center text-xl font-bold">{t("title")}</DialogTitle>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {items.map((item) => (
              <div key={item.key} className="rounded-lg bg-slate-50 p-2 text-center">
                <dd className="text-2xl font-bold tabular-nums" data-testid={`stat-${item.key}`}>
                  {item.value}
                </dd>
                <dt className="text-xs text-slate-600">{t(item.key)}</dt>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-center text-xs text-slate-600">{t(synced ? "synced" : "deviceOnly")}</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full rounded-lg border border-slate-300 py-2 text-sm"
          >
            {t("close")}
          </button>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
