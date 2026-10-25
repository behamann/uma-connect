"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { msUntilNextPuzzle } from "@/game/daily";

function format(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const parts = [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60];
  return parts.map((n) => String(n).padStart(2, "0")).join(":");
}

export function Countdown() {
  const t = useTranslations("game");
  const [ms, setMs] = useState(() => msUntilNextPuzzle(new Date()));

  useEffect(() => {
    const id = setInterval(() => setMs(msUntilNextPuzzle(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <p className="text-sm text-slate-600" data-testid="countdown">
      {t("nextPuzzle")} <time className="font-mono font-semibold tabular-nums">{format(ms)}</time>
    </p>
  );
}
