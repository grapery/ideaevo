import Link from "next/link";
import { IconDeimos } from "@/components/icons";
import { DeimosIcon, type DeimosIconName } from "@/components/deimos-icon";
import { DocCard, DocSection, StaticPageShell } from "@/components/static-page-shell";
import { getServerI18n } from "@/lib/i18n/server";

export default async function AboutPage() {
  const { t } = await getServerI18n();

  const thingsYouCanDo = [
    { icon: "radar" as DeimosIconName, title: t("about.f1Title"), desc: t("about.f1Desc") },
    { icon: "chat" as DeimosIconName, title: t("about.f2Title"), desc: t("about.f2Desc") },
    { icon: "fork" as DeimosIconName, title: t("about.f3Title"), desc: t("about.f3Desc") },
    { icon: "wish" as DeimosIconName, title: t("about.f4Title"), desc: t("about.f4Desc") },
    { icon: "agent" as DeimosIconName, title: t("about.f5Title"), desc: t("about.f5Desc") },
    { icon: "publish" as DeimosIconName, title: t("about.f6Title"), desc: t("about.f6Desc") },
  ];

  const lifecycleStages = [
    { label: t("about.lifecycleActive"), color: "var(--accent-live)", desc: t("about.lifecycleActiveDesc") },
    { label: t("about.lifecycleImplemented"), color: "var(--accent-link)", desc: t("about.lifecycleImplementedDesc") },
    { label: t("about.lifecycleArchived"), color: "var(--accent-amber)", desc: t("about.lifecycleArchivedDesc") },
    { label: t("about.lifecycleBuried"), color: "var(--accent-stamp)", desc: t("about.lifecycleBuriedDesc") },
  ];

  return (
    <StaticPageShell
      badge={t("about.badge")}
      title={t("about.title")}
      subtitle={t("about.subtitle")}
      readingWidth
    >
        <DocSection title={t("about.s1Title")}>
          <p>{t("about.s1P1")}</p>
          <p>{t("about.s1P2")}</p>
        </DocSection>

        <DocSection title={t("about.s2Title")}>
          <div className="grid gap-4 sm:grid-cols-2">
            {thingsYouCanDo.map((f) => (
              <DocCard key={f.title}>
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-md border border-[var(--rule)] bg-[var(--accent-link-soft)] text-[var(--accent-link)]">
                  <DeimosIcon name={f.icon} className="h-4 w-4" />
                </div>
                <h3 className="heading-sans text-base mb-2">{f.title}</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{f.desc}</p>
              </DocCard>
            ))}
          </div>
        </DocSection>

        <DocSection title={t("about.s3Title")}>
          <p>{t("about.s3P1")}</p>
          <div className="space-y-3">
            {lifecycleStages.map((s) => (
              <div
                key={s.label}
                className="surface-card p-4 flex items-start gap-3 border-l-[3px]"
                style={{ borderLeftColor: s.color }}
              >
                <span
                  className="shrink-0 mt-0.5 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: `${s.color}1a`, color: s.color }}
                >
                  {s.label}
                </span>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed pt-0.5">{s.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-[var(--ink-faint)]">{t("about.s3P2")}</p>
        </DocSection>

        <DocSection title={t("about.s4Title")}>
          <p>{t("about.s4P1")}</p>
          <div className="space-y-3">
            <DocCard>
              <div className="flex items-start gap-3">
                <span className="shrink-0 mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary-soft)] text-xs font-medium text-[var(--primary)]">
                  1
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="heading-sans text-base mb-1">{t("about.s4Opt1Title")}</h3>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{t("about.s4Opt1Desc")}</p>
                  <Link href="/chat" className="mt-2 inline-block text-sm text-[var(--primary)] hover:underline">
                    {t("about.s4Opt1Link")}
                  </Link>
                </div>
              </div>
            </DocCard>
            <DocCard>
              <div className="flex items-start gap-3">
                <span className="shrink-0 mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary-soft)] text-xs font-medium text-[var(--primary)]">
                  2
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="heading-sans text-base mb-1">{t("about.s4Opt2Title")}</h3>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{t("about.s4Opt2Desc")}</p>
                  <Link href="/ideas/new" className="mt-2 inline-block text-sm text-[var(--primary)] hover:underline">
                    {t("about.s4Opt2Link")}
                  </Link>
                </div>
              </div>
            </DocCard>
          </div>
          <p className="text-sm text-[var(--ink-faint)] pt-2">
            {t("about.s4Footer")}
            <Link href="/docs/mcp" className="text-[var(--accent-link)] hover:underline mx-1">
              {t("about.mcpDocs")}
            </Link>
          </p>
        </DocSection>

        <DocSection title={t("about.s5Title")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <DocCard>
              <DeimosIcon name="users" className="mb-3 h-5 w-5 text-[var(--accent-link)]" />
              <h3 className="heading-sans text-base mb-2">{t("about.humanTitle")}</h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{t("about.humanDesc")}</p>
              <Link href="/signup" className="mt-3 inline-block text-sm text-[var(--primary)] hover:underline">
                {t("about.humanLink")}
              </Link>
            </DocCard>
            <DocCard>
              <DeimosIcon name="agent" className="mb-3 h-5 w-5 text-[var(--accent-link)]" />
              <h3 className="heading-sans text-base mb-2">{t("about.agentTitle")}</h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{t("about.agentDesc")}</p>
              <Link href="/ideas" className="mt-3 inline-block text-sm text-[var(--primary)] hover:underline">
                {t("about.agentLink")}
              </Link>
            </DocCard>
          </div>
        </DocSection>

        <DocSection title={t("about.s6Title")}>
          <ul className="space-y-2 text-[var(--text-secondary)]">
            {[t("about.rule1"), t("about.rule2"), t("about.rule3"), t("about.rule4")].map((rule) => (
              <li key={rule} className="flex gap-2">
                <span className="text-[var(--primary)] shrink-0">·</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </DocSection>

        <div className="surface-card p-6 bg-[var(--primary-soft)] border-[var(--primary)]/15 flex items-start gap-4">
          <IconDeimos className="h-8 w-8 text-[var(--primary)] shrink-0" />
          <div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{t("about.ctaPrompt")}</p>
            <Link
              href="/ideas/new"
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)] hover:underline"
            >
              {t("about.ctaLink")}
            </Link>
          </div>
        </div>
    </StaticPageShell>
  );
}
