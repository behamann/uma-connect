"use client";

import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { loadBackend } from "@/backend/load";
import { useAuth } from "@/hooks/useAuth";
import { SignInDialog } from "./SignInDialog";

const buttonClass = "rounded-md px-3 py-1.5 text-sm hover:bg-white";

export function AccountMenu() {
  const t = useTranslations("auth");
  const auth = useAuth();
  const [signInOpen, setSignInOpen] = useState(false);

  if (auth.status === "disabled") return null;
  if (auth.status !== "signed-in") {
    return (
      <>
        {auth.status === "loading" ? (
          <span className={`${buttonClass} text-slate-600`}>{t("account")}</span>
        ) : (
          <button type="button" onClick={() => setSignInOpen(true)} className={buttonClass}>
            {t("signIn")}
          </button>
        )}
        <SignInDialog open={signInOpen} onClose={() => setSignInOpen(false)} />
      </>
    );
  }

  return (
    <Menu as="div" className="relative">
      <MenuButton className={buttonClass}>{t("account")}</MenuButton>
      <MenuItems
        anchor="bottom end"
        className="z-40 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-lg focus:outline-none"
      >
        <p className="truncate px-3 py-2 text-xs text-slate-600" data-testid="signed-in-as">
          {t("signedInAs", { email: auth.user.email ?? "" })}
        </p>
        <MenuItem>
          <Link
            href="/account"
            className="block w-full rounded-md px-3 py-2 text-left text-sm data-focus:bg-slate-100"
          >
            {t("settings")}
          </Link>
        </MenuItem>
        <MenuItem>
          <button
            type="button"
            onClick={() => void loadBackend().then((b) => b.auth.signOut())}
            className="block w-full rounded-md px-3 py-2 text-left text-sm data-focus:bg-slate-100"
          >
            {t("signOut")}
          </button>
        </MenuItem>
      </MenuItems>
    </Menu>
  );
}
