// Statically importable: no SDK code here (research R10).
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** False for guest-only builds: account UI is hidden and the SDK is never loaded. */
export const backendEnabled = SUPABASE_URL !== "" && SUPABASE_PUBLISHABLE_KEY !== "";

export const AUTH_STORAGE_KEY = "umagrid:v1:auth";
