"use client";

import { Field, Label, Switch } from "@headlessui/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import type { Profile, RejectionCode } from "@/backend/api";
import { loadBackend } from "@/backend/load";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "./AppHeader";
import { SignInDialog } from "./SignInDialog";

const DELETE_WORD = "DELETE";
const NAME_ERRORS = ["name_length", "name_chars", "name_reserved", "name_taken"] as const;
type NameError = (typeof NAME_ERRORS)[number] | "failed";
const subscribe = () => () => {};

function ProfileSettings({ initial }: { initial: Profile }) {
  const t = useTranslations("account");
  const router = useRouter();
  const [profile, setProfile] = useState(initial);
  const [name, setName] = useState(initial.display_name);
  const [nameState, setNameState] = useState<"idle" | "saving" | "saved" | NameError>("idle");
  const [optOutFailed, setOptOutFailed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleteState, setDeleteState] = useState<"idle" | "confirm" | "deleting" | "failed">("idle");

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    setNameState("saving");
    const res = await (await loadBackend()).api.updateProfile({ displayName: name });
    if (res.ok) {
      setProfile(res.data);
      setName(res.data.display_name);
      setNameState("saved");
    } else {
      const code: RejectionCode | null = res.error.kind === "rejected" ? res.error.code : null;
      setNameState(NAME_ERRORS.find((c) => c === code) ?? "failed");
    }
  };

  const toggleLeaderboard = async (show: boolean) => {
    setOptOutFailed(false);
    const res = await (await loadBackend()).api.updateProfile({ optOut: !show });
    if (res.ok) setProfile(res.data);
    else setOptOutFailed(true);
  };

  const download = async () => {
    setExporting(true);
    const res = await (await loadBackend()).api.exportMyData();
    setExporting(false);
    if (!res.ok) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "uma-connect-export.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const deleteAccount = async () => {
    setDeleteState("deleting");
    const ok = await (await loadBackend()).auth.deleteAccount();
    if (ok) router.replace("/");
    else setDeleteState("failed");
  };

  const nameError = nameState === "idle" || nameState === "saving" || nameState === "saved" ? null : nameState;

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">{t("emailTitle")}</h2>
        <p className="mt-1 text-sm text-slate-700" data-testid="account-email">
          {profile.email}
        </p>
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <form onSubmit={saveName} className="flex flex-col gap-2">
          <label htmlFor="display-name" className="font-semibold">
            {t("nameTitle")}
          </label>
          <p id="display-name-hint" className="text-sm text-slate-600">
            {t("nameHint")}
          </p>
          <div className="flex gap-2">
            <input
              id="display-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameState("idle");
              }}
              maxLength={20}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={`display-name-hint${nameError ? " display-name-error" : ""}`}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2"
            />
            <button
              type="submit"
              disabled={nameState === "saving" || name.trim() === profile.display_name}
              className="rounded-lg bg-brand px-4 py-2 font-medium text-white disabled:opacity-60"
            >
              {t("save")}
            </button>
          </div>
          {nameError && (
            <p id="display-name-error" role="alert" className="text-sm text-red-700">
              {t(`nameError.${nameError}`)}
            </p>
          )}
          {nameState === "saved" && (
            <p role="status" className="text-sm text-green-700">
              {t("saved")}
            </p>
          )}
        </form>
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <Field className="flex items-center justify-between gap-3">
          <div>
            <Label className="font-semibold">{t("leaderboardTitle")}</Label>
            <p className="text-sm text-slate-600">{t("leaderboardHint")}</p>
          </div>
          <Switch
            checked={!profile.leaderboard_opt_out}
            onChange={(show) => void toggleLeaderboard(show)}
            className="group relative inline-flex h-6 w-11 shrink-0 rounded-full bg-slate-300 transition data-checked:bg-brand"
          >
            <span className="inline-block size-5 translate-x-0.5 translate-y-0.5 rounded-full bg-white transition group-data-checked:translate-x-5.5" />
          </Switch>
        </Field>
        {optOutFailed && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {t("nameError.failed")}
          </p>
        )}
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">{t("exportTitle")}</h2>
        <p className="mt-1 text-sm text-slate-600">{t("exportHint")}</p>
        <button
          type="button"
          onClick={() => void download()}
          disabled={exporting}
          className="mt-2 rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-60"
        >
          {t("exportButton")}
        </button>
      </section>

      <section className="rounded-xl border border-red-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-red-800">{t("deleteTitle")}</h2>
        <p className="mt-1 text-sm text-slate-700">{t("deleteHint")}</p>
        {deleteState === "idle" ? (
          <button
            type="button"
            onClick={() => setDeleteState("confirm")}
            className="mt-2 rounded-lg border border-red-300 px-4 py-2 text-sm text-red-800"
          >
            {t("deleteButton")}
          </button>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            <label htmlFor="delete-confirm" className="text-sm">
              {t("deleteConfirmLabel", { word: DELETE_WORD })}
            </label>
            <input
              id="delete-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void deleteAccount()}
                disabled={confirmText !== DELETE_WORD || deleteState === "deleting"}
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {t("deleteConfirm")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteState("idle");
                  setConfirmText("");
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
              >
                {t("cancel")}
              </button>
            </div>
            {deleteState === "failed" && (
              <p role="alert" className="text-sm text-red-700">
                {t("deleteFailed")}
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function SignedInAccount() {
  const t = useTranslations("account");
  const [profile, setProfile] = useState<Profile | null | "error">(null);

  useEffect(() => {
    let active = true;
    void loadBackend()
      .then((b) => b.api.getMyProfile())
      .then((res) => active && setProfile(res.ok ? res.data : "error"));
    return () => {
      active = false;
    };
  }, []);

  if (profile === "error") {
    return (
      <p role="alert" className="text-center text-red-700">
        {t("loadFailed")}
      </p>
    );
  }
  if (!profile) return <p className="text-center text-slate-600">{t("loading")}</p>;
  return <ProfileSettings initial={profile} />;
}

/** Client-only: depends on the stored session. */
export function AccountPage() {
  const t = useTranslations("account");
  const auth = useAuth();
  const isClient = useSyncExternalStore(subscribe, () => true, () => false);
  const [signInOpen, setSignInOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {isClient && <AppHeader />}
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      {!isClient || auth.status === "loading" ? (
        <p className="text-center text-slate-600">{t("loading")}</p>
      ) : auth.status === "signed-in" ? (
        <SignedInAccount key={auth.user.id} />
      ) : auth.status === "guest" ? (
        <div className="rounded-xl bg-white p-4 text-center shadow-sm">
          <p>{t("signInPrompt")}</p>
          <button
            type="button"
            onClick={() => setSignInOpen(true)}
            className="mt-3 rounded-lg bg-brand px-4 py-2 font-medium text-white"
          >
            {t("signIn")}
          </button>
          <SignInDialog open={signInOpen} onClose={() => setSignInOpen(false)} />
        </div>
      ) : (
        <p className="text-center text-slate-600">{t("unavailable")}</p>
      )}
    </div>
  );
}
