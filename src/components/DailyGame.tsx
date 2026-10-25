"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { getStorage, loadDailyPuzzle, useGame, type Persistence } from "@/hooks/useGame";
import type { Grid } from "@/game/types";
import { AppHeader } from "./AppHeader";
import { Countdown } from "./Countdown";
import { GameBoard } from "./GameBoard";

function DailyBoard({ grid, persistence }: { grid: Grid; persistence: Persistence }) {
  const game = useGame(grid, `daily:${persistence.puzzleNumber}`, persistence);
  return <GameBoard game={game} puzzleNumber={persistence.puzzleNumber} footer={<Countdown />} />;
}

/** Client-only: the daily puzzle depends on the player's clock and local storage. */
export default function DailyGame() {
  const t = useTranslations("game");
  const format = useFormatter();
  // Computed once per page load: a game left open across 00:00 UTC stays on its puzzle.
  const [{ puzzle, today }] = useState(() => {
    const now = new Date();
    return { puzzle: loadDailyPuzzle(now), today: now };
  });

  return (
    <div className="flex flex-col gap-3">
      <AppHeader active="daily" />
      <header className="text-center">
        <h1 className="text-2xl font-bold">
          {t("dailyTitle", { number: puzzle.puzzleNumber })}
        </h1>
        <p className="text-sm text-slate-600">
          {format.dateTime(today, { dateStyle: "long", timeZone: "UTC" })}
        </p>
      </header>
      {puzzle.status === "ok" ? (
        <DailyBoard
          grid={puzzle.grid}
          persistence={{ storage: getStorage(), puzzleNumber: puzzle.puzzleNumber }}
        />
      ) : (
        <p role="alert" className="rounded-xl bg-amber-50 p-4 text-center text-amber-900">
          {t("noPuzzle")}
        </p>
      )}
    </div>
  );
}
