import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common");
  return { title: t("title"), description: t("description") };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const t = await getTranslations("common");

  return (
    <html lang={locale}>
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider>
          <main className="mx-auto w-full max-w-xl flex-1 px-3 py-4">{children}</main>
          <footer className="px-4 py-6 text-center text-xs text-slate-600">
            <p>{t("fanNotice")}</p>
            <Link href="/about" className="mt-1 inline-block underline">
              {t("aboutLink")}
            </Link>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
