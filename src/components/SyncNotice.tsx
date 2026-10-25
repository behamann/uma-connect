"use client";

import { useTranslations } from "next-intl";
import { useCallback, useSyncExternalStore } from "react";
import { getStorage } from "@/hooks/useGame";
import { SYNC_NOTICE_KEY } from "@/storage/local";

/** Tells the player once that another device's game replaced this one (FR-012). */
export function SyncNotice({ puzzleNumber }: { puzzleNumber: number }) {
  const t = useTranslations("sync");
  const storage = getStorage();
  const subscribe = useCallback(
    (listener: () => void) => storage.subscribe(SYNC_NOTICE_KEY, listener),
    [storage],
  );
  const raw = useSyncExternalStore(subscribe, () => storage.getRaw(SYNC_NOTICE_KEY), () => null);
  if (raw === null || Number(raw) !== puzzleNumber) return null;

  return (
    <div
      role="status"
      className="flex items-start justify-between gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
    >
      <p>{t("otherDeviceKept")}</p>
      <button
        type="button"
        onClick={() => storage.remove(SYNC_NOTICE_KEY)}
        className="shrink-0 rounded-md px-2 py-1 font-medium underline"
      >
        {t("dismiss")}
      </button>
    </div>
  );
}
