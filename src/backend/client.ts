import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AUTH_STORAGE_KEY, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";
import type { Database } from "./database.types";

let client: SupabaseClient<Database> | undefined;

export function getClient(): SupabaseClient<Database> {
  client ??= createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      // /auth/callback exchanges the code explicitly.
      detectSessionInUrl: false,
      storageKey: AUTH_STORAGE_KEY,
    },
  });
  return client;
}
