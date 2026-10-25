"use client";

import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { useTranslations } from "next-intl";

const RULES = ["pick", "match", "guesses", "noReuse", "versions", "rules", "reset"] as const;

export function HowToPlayDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("howToPlay");
  return (
    <Dialog open={open} onClose={onClose} className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div className="fixed inset-0 flex items-start justify-center overflow-y-auto p-3 pt-[8vh]">
        <DialogPanel className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
          <DialogTitle className="text-xl font-bold">{t("title")}</DialogTitle>
          <p className="mt-1 text-slate-600">{t("goal")}</p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
            {RULES.map((key) => (
              <li key={key}>{t(`rule.${key}`)}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onClose}
            className="mt-5 w-full rounded-lg bg-brand py-2 font-medium text-white hover:bg-brand-dark"
          >
            {t("start")}
          </button>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
