"use client";

import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import type { SignInError } from "@/backend/auth";
import { loadBackend } from "@/backend/load";
import { startAuth } from "@/hooks/useAuth";

export function SignInDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<"form" | "sending" | "sent">("form");
  const [error, setError] = useState<SignInError | null>(null);

  const close = () => {
    onClose();
    setPhase("form");
    setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setPhase("sending");
    setError(null);
    try {
      startAuth();
      const backend = await loadBackend();
      const result = await backend.auth.signInWithEmail(email.trim());
      if (result.ok) {
        setPhase("sent");
        return;
      }
      setError(result.error);
    } catch {
      setError("unavailable");
    }
    setPhase("form");
  };

  return (
    <Dialog open={open} onClose={close} className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div className="fixed inset-0 flex items-start justify-center p-3 pt-[10vh]">
        <DialogPanel className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
          <DialogTitle className="text-center text-xl font-bold">{t("title")}</DialogTitle>
          {phase === "sent" ? (
            <div role="status" className="mt-4 space-y-2 text-center">
              <p className="font-medium">{t("checkEmail")}</p>
              <p className="text-sm text-slate-600">{t("checkEmailHint", { email: email.trim() })}</p>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-4 space-y-3">
              <p className="text-sm text-slate-600">{t("intro")}</p>
              <label className="block text-sm font-medium">
                {t("email")}
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={error === "invalid_email" || undefined}
                  aria-describedby={error ? "sign-in-error" : undefined}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
              {error && (
                <p id="sign-in-error" role="alert" className="text-sm text-red-700">
                  {t(`error.${error}`)}
                </p>
              )}
              <button
                type="submit"
                disabled={phase === "sending"}
                className="w-full rounded-lg bg-brand py-2 font-medium text-white disabled:opacity-60"
              >
                {phase === "sending" ? t("sending") : t("sendLink")}
              </button>
              <p className="text-xs text-slate-600">{t("privacyNote")}</p>
            </form>
          )}
          <button
            type="button"
            onClick={close}
            className="mt-4 w-full rounded-lg border border-slate-300 py-2 text-sm"
          >
            {t("close")}
          </button>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
