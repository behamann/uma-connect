/** Reads URL and keys of the running local Supabase stack (`supabase start`). */
import { execSync } from "node:child_process";

export interface StackEnv {
  url: string;
  publishableKey: string;
  secretKey: string;
}

export function localStack(): StackEnv | null {
  let out: string;
  try {
    out = execSync("npx supabase status -o json", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 60_000,
    });
  } catch {
    return null;
  }
  const json = out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1);
  try {
    const s = JSON.parse(json) as Record<string, string | undefined>;
    if (!s.API_URL || !s.PUBLISHABLE_KEY || !s.SECRET_KEY) return null;
    return { url: s.API_URL, publishableKey: s.PUBLISHABLE_KEY, secretKey: s.SECRET_KEY };
  } catch {
    return null;
  }
}

export function isLocalUrl(url: string): boolean {
  const host = new URL(url).hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}
