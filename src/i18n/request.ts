import { getRequestConfig } from "next-intl/server";

export const DEFAULT_LOCALE = "en";

// Single locale for the PoC; add `app/[locale]` routing when a second language ships.
export default getRequestConfig(async () => ({
  locale: DEFAULT_LOCALE,
  messages: (await import(`../../messages/${DEFAULT_LOCALE}.json`)).default,
  timeZone: "UTC",
}));
