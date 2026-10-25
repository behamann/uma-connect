"use client";

import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { useCategoryText } from "@/hooks/useDatasetText";
import type { CategoryId } from "@/game/types";

export function CategoryHeader({ id }: { id: CategoryId }) {
  const text = useCategoryText()(id);
  return (
    <Popover className="relative h-full">
      <PopoverButton className="flex h-full w-full items-center justify-center rounded-md p-1 text-center text-xs leading-tight font-semibold text-slate-700 underline decoration-slate-300 decoration-dotted underline-offset-2 hover:bg-white sm:text-sm">
        {text.label}
      </PopoverButton>
      <PopoverPanel
        anchor="bottom"
        className="z-40 w-60 rounded-lg bg-slate-800 p-3 text-sm text-white shadow-lg [--anchor-gap:4px]"
      >
        <p className="font-semibold">{text.label}</p>
        <p className="mt-1 text-slate-200">{text.rule}</p>
      </PopoverPanel>
    </Popover>
  );
}
