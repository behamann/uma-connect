"use client";

import { useSyncExternalStore } from "react";
import { backendEnabled } from "@/backend/config";
import { hasStoredSession, loadBackend } from "@/backend/load";
import type { AccountUser } from "@/backend/auth";

export type AuthState =
  | { status: "disabled" }
  | { status: "guest" }
  | { status: "loading" }
  | { status: "signed-in"; user: AccountUser };

const DISABLED: AuthState = { status: "disabled" };
const GUEST: AuthState = { status: "guest" };
const LOADING: AuthState = { status: "loading" };

let state: AuthState | null = null;
let started = false;
const listeners = new Set<() => void>();

function set(next: AuthState) {
  state = next;
  listeners.forEach((l) => l());
}

/** Loads the SDK only when a session is stored or the player starts signing in (research R10). */
export function startAuth() {
  if (started || !backendEnabled) return;
  started = true;
  if (hasStoredSession() && state?.status !== "signed-in") set(LOADING);
  loadBackend()
    .then((b) => b.auth.onAuthChange((user) => set(user ? { status: "signed-in", user } : GUEST)))
    .catch(() => set(GUEST));
}

function snapshot(): AuthState {
  if (state) return state;
  if (!backendEnabled) return DISABLED;
  return hasStoredSession() ? LOADING : GUEST;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (backendEnabled && hasStoredSession()) startAuth();
  return () => listeners.delete(listener);
}

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, snapshot, () => DISABLED);
}
