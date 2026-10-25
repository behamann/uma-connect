"use client";

import { useTranslations } from "next-intl";
import { Portrait } from "./Portrait";
import type { TraineeView } from "@/hooks/useDatasetText";

export function GridCell({
  rowLabel,
  colLabel,
  trainee,
  disabled,
  onSelect,
}: {
  rowLabel: string;
  colLabel: string;
  trainee: TraineeView | undefined;
  disabled: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations("game");
  const label = trainee
    ? t("cellFilled", { row: rowLabel, col: colLabel, name: trainee.displayName })
    : t("cellEmpty", { row: rowLabel, col: colLabel });

  return (
    <button
      type="button"
      role="gridcell"
      aria-label={label}
      aria-disabled={disabled || !!trainee}
      data-filled={trainee ? "true" : "false"}
      onClick={() => !disabled && !trainee && onSelect()}
      className={`flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border p-1 text-center transition ${
        trainee
          ? "border-emerald-400 bg-emerald-50"
          : disabled
            ? "cursor-default border-slate-200 bg-slate-50"
            : "border-slate-300 bg-white hover:border-brand hover:bg-blue-50"
      }`}
    >
      {trainee && (
        <>
          <Portrait src={trainee.portrait} name={trainee.name} size={48} />
          <span className="line-clamp-2 text-[11px] font-medium leading-tight sm:text-xs">
            {trainee.name}
          </span>
          {trainee.version && (
            <span className="line-clamp-1 text-[10px] leading-tight text-slate-600">
              {trainee.version}
            </span>
          )}
        </>
      )}
    </button>
  );
}
