"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { isFinished, remainingGuesses, score } from "@/game/session";
import type { GameController } from "@/hooks/useGame";
import { useCategoryText, useTraineeLookup } from "@/hooks/useDatasetText";
import { CategoryHeader } from "./CategoryHeader";
import { GridCell } from "./GridCell";
import { GuessDialog } from "./GuessDialog";
import { ResultsDialog } from "./ResultsDialog";

export function GameBoard({
  game,
  puzzleNumber,
  footer,
}: {
  game: GameController;
  /** null in practice mode */
  puzzleNumber: number | null;
  footer?: React.ReactNode;
}) {
  const t = useTranslations("game");
  const categoryText = useCategoryText();
  const lookup = useTraineeLookup();
  const { session, resolved } = game;
  const { rows, cols } = resolved.grid;
  const finished = isFinished(session);

  const [activeCell, setActiveCell] = useState<number | null>(null);
  const [confirmingGiveUp, setConfirmingGiveUp] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [resultsOpen, setResultsOpen] = useState(false);

  const cellTitle = (cell: number) =>
    `${categoryText(rows[Math.floor(cell / 3)]!).label} × ${categoryText(cols[cell % 3]!).label}`;

  const usedIds = new Set(session.cells.filter((c): c is string => c !== null));

  const pick = (id: string) => {
    if (activeCell === null) return;
    const { outcome, finished: nowFinished } = game.guess(activeCell, id);
    const name = lookup(id)?.displayName ?? id;
    const where = cellTitle(activeCell);
    if (outcome === "correct") setAnnouncement(t("correct", { name, where }));
    if (outcome === "incorrect") setAnnouncement(t("incorrect", { name, where }));
    setActiveCell(null);
    if (nowFinished) setResultsOpen(true);
  };

  return (
    <section aria-label={t("boardLabel")} className="flex flex-col gap-3">
      <div role="grid" aria-label={t("gridLabel")} className="grid grid-cols-[minmax(0,0.8fr)_repeat(3,minmax(0,1fr))] gap-1.5">
        <div role="row" className="contents">
          <div role="columnheader" aria-hidden="true" />
          {cols.map((id) => (
            <div key={id} role="columnheader">
              <CategoryHeader id={id} />
            </div>
          ))}
        </div>
        {rows.map((rowId, r) => (
          <div key={rowId} role="row" className="contents">
            <div role="rowheader">
              <CategoryHeader id={rowId} />
            </div>
            {cols.map((colId, c) => {
              const cell = r * 3 + c;
              const id = session.cells[cell];
              return (
                <GridCell
                  key={colId}
                  rowLabel={categoryText(rowId).label}
                  colLabel={categoryText(colId).label}
                  trainee={id ? lookup(id) : undefined}
                  disabled={finished}
                  onSelect={() => setActiveCell(cell)}
                />
              );
            })}
          </div>
        ))}
      </div>

      <p aria-live="polite" className="min-h-5 text-center text-sm text-slate-700" data-testid="announcement">
        {announcement}
      </p>

      {!finished ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium" data-testid="remaining">
            {t("remaining", { count: remainingGuesses(session) })}
          </span>
          {confirmingGiveUp ? (
            <span className="flex gap-2">
              <button
                type="button"
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white"
                onClick={() => {
                  game.giveUp();
                  setConfirmingGiveUp(false);
                  setResultsOpen(true);
                }}
              >
                {t("confirmGiveUp")}
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                onClick={() => setConfirmingGiveUp(false)}
              >
                {t("cancel")}
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              onClick={() => setConfirmingGiveUp(true)}
            >
              {t("giveUp")}
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-white p-4 shadow-sm">
          <p className="text-lg font-semibold" data-testid="final-score">
            {t("finalScore", { score: score(session) })}
          </p>
          <button
            type="button"
            className="rounded-lg bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark"
            onClick={() => setResultsOpen(true)}
          >
            {t("showResults")}
          </button>
          {footer}
        </div>
      )}

      <ResultsDialog
        open={resultsOpen && finished}
        onClose={() => setResultsOpen(false)}
        game={game}
        puzzleNumber={puzzleNumber}
      />

      <GuessDialog
        open={activeCell !== null}
        title={activeCell !== null ? cellTitle(activeCell) : ""}
        usedIds={usedIds}
        onPick={pick}
        onClose={() => setActiveCell(null)}
      />
    </section>
  );
}
