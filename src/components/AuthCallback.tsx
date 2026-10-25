"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { loadBackend } from "@/backend/load";

// Module-level so React StrictMode's double effect doesn't spend the one-time code twice.
let exchange: Promise<boolean> | undefined;

export function AuthCallback() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    exchange ??= code
      ? loadBackend().then((b) => b.auth.exchangeCode(code)).catch(() => false)
      : Promise.resolve(false);
    void exchange.then((ok) => (ok ? router.replace("/") : setFailed(true)));
  }, [router]);

  if (!failed) {
    return (
      <p role="status" className="py-10 text-center text-slate-600">
        {t("signingIn")}
      </p>
    );
  }
  return (
    <div role="alert" className="mx-auto max-w-sm space-y-3 py-10 text-center">
      <h1 className="text-xl font-bold">{t("callbackError.title")}</h1>
      <p className="text-sm text-slate-600">{t("callbackError.body")}</p>
      <Link href="/" className="inline-block rounded-lg bg-brand px-4 py-2 font-medium text-white">
        {t("callbackError.back")}
      </Link>
    </div>
  );
}
