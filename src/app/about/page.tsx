import { getTranslations } from "next-intl/server";
import Link from "next/link";

const SOURCES = [
  { key: "gametora", href: "https://gametora.com/umamusume" },
  { key: "umamusuWiki", href: "https://umamusu.wiki/" },
] as const;

export default async function AboutPage() {
  const t = await getTranslations("about");
  return (
    <article className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p>{t("intro")}</p>
      <section>
        <h2 className="font-semibold">{t("disclaimerTitle")}</h2>
        <p className="mt-1 text-sm text-slate-700">{t("disclaimer")}</p>
        <p className="mt-1 text-sm text-slate-700">
          {t("guidelines")}{" "}
          <a
            href="https://umamusume.com/fan-createdguide/"
            className="text-brand-dark underline"
            rel="noopener noreferrer"
            target="_blank"
          >
            {t("guidelinesLink")}
          </a>
        </p>
      </section>
      <section>
        <h2 className="font-semibold">{t("sourcesTitle")}</h2>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
          {SOURCES.map((s) => (
            <li key={s.key}>
              <a href={s.href} className="text-brand-dark underline" rel="noopener noreferrer" target="_blank">
                {t(`source.${s.key}.name`)}
              </a>{" "}
              — {t(`source.${s.key}.use`)}
            </li>
          ))}
          <li>{t("source.images")}</li>
        </ul>
      </section>
      <section>
        <h2 className="font-semibold">{t("privacyTitle")}</h2>
        {(["privacy", "privacyAccount", "privacyGuest", "privacyControl", "privacyAge"] as const).map((key) => (
          <p key={key} className="mt-1 text-sm text-slate-700">
            {t(key)}
          </p>
        ))}
        <Link href="/account" className="mt-1 inline-block text-sm text-brand-dark underline">
          {t("accountLink")}
        </Link>
      </section>
      <Link href="/" className="self-start text-brand-dark underline">
        {t("back")}
      </Link>
    </article>
  );
}
