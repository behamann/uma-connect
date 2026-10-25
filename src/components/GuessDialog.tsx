"use client";

import {
  Combobox,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Dialog,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { search } from "@/game/search";
import type { TraineeId } from "@/game/types";
import { searchIndexFor, useTraineeLookup } from "@/hooks/useDatasetText";
import { Portrait } from "./Portrait";

export function GuessDialog({
  open,
  title,
  usedIds,
  onPick,
  onClose,
}: {
  open: boolean;
  title: string;
  usedIds: ReadonlySet<TraineeId>;
  onPick: (id: TraineeId) => void;
  onClose: () => void;
}) {
  const t = useTranslations("game");
  const locale = useLocale();
  const lookup = useTraineeLookup();
  const [query, setQuery] = useState("");
  const results = query.trim() ? search(searchIndexFor(locale), query) : [];

  const close = () => {
    setQuery("");
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div className="fixed inset-0 flex items-start justify-center p-3 pt-[10vh]">
        <DialogPanel className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl">
          <DialogTitle className="mb-3 text-center text-sm font-semibold text-slate-700">
            {title}
          </DialogTitle>
          <Combobox<TraineeId | null>
            value={null}
            onChange={(id) => {
              if (!id || usedIds.has(id)) return;
              setQuery("");
              onPick(id);
            }}
          >
            <ComboboxInput
              autoFocus
              aria-label={t("searchLabel")}
              placeholder={t("searchPlaceholder")}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
            <ComboboxOptions static className="mt-2 max-h-[50vh] overflow-y-auto">
              {query.trim() !== "" && results.length === 0 && (
                <p className="px-3 py-2 text-sm text-slate-600">{t("noResults")}</p>
              )}
              {results.map((id) => {
                const view = lookup(id);
                if (!view) return null;
                const used = usedIds.has(id);
                return (
                  <ComboboxOption
                    key={id}
                    value={id}
                    disabled={used}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 data-disabled:cursor-not-allowed data-disabled:opacity-50 data-focus:bg-blue-50"
                  >
                    <Portrait src={view.portrait} name={view.name} size={36} />
                    <span className="flex flex-col">
                      <span className="text-sm font-medium">{view.name}</span>
                      <span className="text-xs text-slate-600">
                        {view.version ?? t("original")}
                        {used && ` · ${t("alreadyUsed")}`}
                      </span>
                    </span>
                  </ComboboxOption>
                );
              })}
            </ComboboxOptions>
          </Combobox>
          <button
            type="button"
            onClick={close}
            className="mt-3 w-full rounded-lg border border-slate-300 py-2 text-sm"
          >
            {t("cancel")}
          </button>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
