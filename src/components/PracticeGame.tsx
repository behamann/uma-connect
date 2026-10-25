"use client";

import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { dataset } from "@/game/data";
import { generateGrid } from "@/game/generator";
import type { Grid } from "@/game/types";
import { useGame } from "@/hooks/useGame";
import { AppHeader } from "./AppHeader";
import { GameBoard } from "./GameBoard";

const randomSeed = () => Math.random().toString(36).slice(2, 10);

function PracticeBoard({ grid, seed }: { grid: Grid; seed: string }) {
  const game = useGame(grid, `practice:${seed}`);
  return <GameBoard game={game} puzzleNumber={null} />;
}

/** Client-only practice mode: grid derived from `?seed=`; never persisted (FR-020). */
export default function PracticeGame() {
  const t = useTranslations("practice");
  const router = useRouter();
  const params = useSearchParams();
  const [fallbackSeed] = useState(randomSeed);
  const seed = params.get("seed") || fallbackSeed;
  const grid = useMemo(() => generateGrid(dataset, seed), [seed]);

  useEffect(() => {
    if (!params.get("seed")) router.replace(`/practice?seed=${fallbackSeed}`);
  }, [params, router, fallbackSeed]);

  return (
    <div className="flex flex-col gap-3">
      <AppHeader active="practice" />
      <header className="text-center">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-slate-600">{t("subtitle")}</p>
      </header>
      {grid ? (
        <PracticeBoard key={seed} grid={grid} seed={seed} />
      ) : (
        <p role="alert" className="rounded-xl bg-amber-50 p-4 text-center text-amber-900">
          {t("noGrid")}
        </p>
      )}
      <button
        type="button"
        onClick={() => router.push(`/practice?seed=${randomSeed()}`)}
        className="self-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium"
      >
        {t("newGrid")}
      </button>
    </div>
  );
}
