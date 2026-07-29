import Link from "next/link";
import { DocSection, StaticPageShell } from "@/components/static-page-shell";
import { getServerI18n } from "@/lib/i18n/server";

export default async function PrivacyPage() {
  const { t } = await getServerI18n();

  const sections = [
    {
      title: t("privacy.s1Title"),
      items: [
        t("privacy.s1Item1"),
        t("privacy.s1Item2"),
        t("privacy.s1Item3"),
      ],
    },
    {
      title: t("privacy.s2Title"),
      items: [
        t("privacy.s2Item1"),
        t("privacy.s2Item2"),
        t("privacy.s2Item3"),
        t("privacy.s2Item4"),
      ],
    },
    {
      title: t("privacy.s3Title"),
      items: [
        t("privacy.s3Item1"),
        t("privacy.s3Item2"),
        t("privacy.s3Item3"),
      ],
    },
    {
      title: t("privacy.s4Title"),
      items: [
        t("privacy.s4Item1"),
        t("privacy.s4Item2"),
        t("privacy.s4Item3"),
      ],
    },
    {
      title: t("privacy.s5Title"),
      items: [
        t("privacy.s5Item1"),
        t("privacy.s5Item2"),
        t("privacy.s5Item3"),
      ],
    },
  ];

  return (
    <StaticPageShell
      badge={t("privacy.title")}
      title={t("privacy.title")}
      subtitle={t("privacy.subtitle")}
    >
      <div className="max-w-3xl space-y-10">
        <p className="text-sm text-[var(--text-muted)]">{t("doc.lastUpdate")}</p>

        {sections.map((section) => (
          <DocSection key={section.title} title={section.title}>
            <ul className="space-y-2 list-disc pl-5 text-[var(--text-secondary)]">
              {section.items.map((item) => (
                <li key={item} className="leading-relaxed">{item}</li>
              ))}
            </ul>
          </DocSection>
        ))}

        <DocSection title={t("doc.policyChange")}>
          <p>{t("doc.policyChangeDesc")}</p>
        </DocSection>

        <p className="text-sm text-[var(--text-muted)]">
          {t("doc.policyConsent")}{" "}
          <Link href="/about" className="text-[var(--primary)] hover:underline">
            {t("doc.aboutDeimos")}
          </Link>
          。
        </p>
      </div>
    </StaticPageShell>
  );
}
