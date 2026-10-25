"use client";

import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { cellRarity, rarityScore } from "@/game/rarity";
import { isFinished, score } from "@/game/session";
import { shareText } from "@/game/share";
import type { GameController } from "@/hooks/useGame";
import { useCategoryText, useTraineeLookup } from "@/hooks/useDatasetText";
import { useRarity } from "@/hooks/useRarity";
import { withBasePath } from "@/lib/basePath";
import { Countdown } from "./Countdown";
import { Portrait } from "./Portrait";

export function ResultsDialog({
  open,
  onClose,
  game,
  puzzleNumber,
}: {
  open: boolean;
  onClose: () => void;
  game: GameController;
  puzzleNumber: number | null;
}) {
  const t = useTranslations("results");
  const categoryText = useCategoryText();
  const lookup = useTraineeLookup();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const { session, resolved } = game;
  const { rows, cols } = resolved.grid;
  const format = useFormatter();
  const rarity = useRarity(puzzleNumber, isFinished(session));
  const total = rarity.status === "ready" ? rarityScore(rarity.data, session.cells) : null;
  const rarityNote =
    rarity.status === "ready"
      ? t("rarityScore", { score: total ?? 0 })
      : rarity.status === "insufficient"
        ? t("rarityInsufficient", { count: rarity.finishedGames, threshold: rarity.threshold })
        : t(`rarityStatus.${rarity.status}`);
  const cellRarityText = (cell: number, picked: string | null) =>
    rarity.status === "ready"
      ? format.number(cellRarity(rarity.data, cell, picked)! / 100, { style: "percent", maximumFractionDigits: 1 })
      : "—";

  const text = () =>
    shareText(
      session,
      puzzleNumber,
      `${window.location.origin}${withBasePath("/")}`,
      {
        daily: (number, s) => t("shareDaily", { number, score: s }),
        practice: (s) => t("sharePractice", { score: s }),
        rarity: (r) => t("shareRarity", { score: r }),
      },
      total,
    );

  const share = async () => {
    try {
      await navigator.clipboard.writeText(text());
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div className="fixed inset-0 flex items-start justify-center overflow-y-auto p-3 pt-[5vh]">
        <DialogPanel className="w-full max-w-lg rounded-xl bg-white p-4 shadow-xl">
          <DialogTitle className="text-center text-xl font-bold">{t("title")}</DialogTitle>
          <p className="mt-1 text-center text-lg" data-testid="results-score">
            {t("score", { score: score(session) })}
          </p>
          <p className="text-center text-sm text-slate-600" data-testid="results-rarity">
            {rarityNote}
          </p>

          <div className="mt-3 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={share}
              className="rounded-lg bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark"
            >
              {t("share")}
            </button>
            <p aria-live="polite" className="min-h-5 text-sm text-slate-600">
              {copyState === "copied" && t("copied")}
              {copyState === "failed" && t("copyFailed")}
            </p>
            {copyState === "failed" && (
              <textarea
                readOnly
                aria-label={t("shareTextLabel")}
                className="h-28 w-full rounded border border-slate-300 p-2 font-mono text-sm"
                value={text()}
                onFocus={(e) => e.currentTarget.select()}
              />
            )}
            {puzzleNumber !== null && <Countdown />}
          </div>

          <h3 className="mt-4 text-sm font-semibold text-slate-700">{t("answersHeading")}</h3>
          <ol className="mt-2 flex flex-col gap-2" data-testid="results-cells">
            {resolved.answers.flatMap((rowAnswers, r) =>
              rowAnswers.map((answers, c) => {
                const cell = r * 3 + c;
                const picked = session.cells[cell];
                const pickedView = picked ? lookup(picked) : undefined;
                return (
                  <li key={cell} className="rounded-lg border border-slate-200 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-600">
                        {categoryText(rows[r]!).label} × {categoryText(cols[c]!).label}
                      </span>
                      <span
                        className="text-xs text-slate-600"
                        title={rarity.status === "ready" ? undefined : rarityNote}
                        data-testid="cell-rarity"
                      >
                        {t("rarity")}: {cellRarityText(cell, picked ?? null)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm">
                      {pickedView ? (
                        <>
                          <Portrait src={pickedView.portrait} name={pickedView.name} size={28} />
                          <span className="font-medium">{pickedView.displayName}</span>
                        </>
                      ) : (
                        <span className="text-slate-600">{t("notFilled")}</span>
                      )}
                    </div>
                    <details className="mt-1 text-xs">
                      <summary className="cursor-pointer text-brand-dark">
                        {t("validAnswers", { count: answers.length })}
                      </summary>
                      <ul className="mt-1 columns-2 gap-3">
                        {answers.map((id) => (
                          <li key={id} className={id === picked ? "font-semibold" : undefined}>
                            {lookup(id)?.displayName ?? id}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </li>
                );
              }),
            )}
          </ol>

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
