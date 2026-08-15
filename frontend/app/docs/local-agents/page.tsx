import Link from "next/link";
import { IconDeimos } from "@/components/icons";
import { StaticPageShell, DocsToc, DocSection } from "@/components/static-page-shell";
import { LocalAgentsSections } from "./local-agents-client";
import { getServerI18n } from "@/lib/i18n/server";

export default async function LocalAgentsDocsPage() {
  const { t } = await getServerI18n();

  const toc = [
    { href: "#how", label: t("docs.local.tocHow") },
    { href: "#plugin", label: t("docs.local.pluginTitle") },
    { href: "#connect", label: t("docs.local.tocConnect") },
    { href: "#skill", label: t("docs.local.tocSkill") },
    { href: "#auto", label: t("docs.local.tocAuto") },
    { href: "#workflow", label: t("docs.local.tocWorkflow") },
  ];

  const workflow = [
    { tool: "claim_next_job", desc: t("docs.local.wfClaim") },
    { tool: "send_progress", desc: t("docs.local.wfProgress") },
    { tool: "ask_user", desc: t("docs.local.wfAsk") },
    { tool: "report_job_result", desc: t("docs.local.wfReport") },
  ];

  return (
    <StaticPageShell
      badge={t("docs.local.badge")}
      title={t("docs.local.title")}
      subtitle={t("docs.local.subtitle")}
    >
      <div className="flex flex-col gap-8 lg:flex-row">
        <DocsToc items={toc} />

        <section className="min-w-0 flex-1 space-y-10">
          {/* 工作原理 */}
          <DocSection id="how" title={t("docs.local.howTitle")}>
            <p className="text-[14px] leading-7 text-[var(--ink-soft)]">
              {t("docs.local.howDesc")}
            </p>
            <div className="mt-4 space-y-2">
              {(
                [
                  ["howStep1", "01"],
                  ["howStep2", "02"],
                  ["howStep3", "03"],
                ] as const
              ).map(([key, num]) => (
                <div
                  key={key}
                  className="surface-card flex items-start gap-3 border-l-[3px] border-l-[var(--ink)] p-3"
                >
                  <span className="meta-label text-[var(--ink)]">{num}</span>
                  <p className="text-[13px] leading-6 text-[var(--ink-soft)]">{t(`docs.local.${key}`)}</p>
                </div>
              ))}
            </div>
          </DocSection>

          <LocalAgentsSections />

          {/* 工具与页面 */}
          <DocSection id="workflow" title={t("docs.local.workflowTitle")}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {workflow.map((item) => (
                <div
                  key={item.tool}
                  className="surface-card border-l-[3px] border-l-[var(--accent-link)] p-3"
                >
                  <code className="code-text text-[var(--accent-link)]">{item.tool}</code>
                  <p className="mt-1 text-[12px] leading-relaxed text-[var(--ink-soft)]">{item.desc}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[13px] leading-6 text-[var(--ink-faint)]">
              {t("docs.local.workflowPageHint")}{" "}
              <Link href="/user/jobs" className="text-[var(--accent-link)] hover:underline">
                {t("docs.local.workflowPageLink")}
              </Link>
            </p>
          </DocSection>

          <div className="surface-card flex flex-col items-start gap-4 border-l-[3px] border-l-[var(--accent-stamp)] p-4 sm:flex-row sm:items-center">
            <IconDeimos className="h-7 w-7 shrink-0 text-[var(--ink)]" />
            <div className="flex-1">
              <h3 className="text-[15px] font-semibold text-[var(--ink)]">{t("docs.local.ctaTitle")}</h3>
              <p className="mt-1 text-[13px] text-[var(--ink-soft)]">{t("docs.local.ctaDesc")}</p>
            </div>
            <Link href="/user/jobs" className="btn-outline btn-sm shrink-0">
              {t("docs.local.ctaLink")}
            </Link>
          </div>
        </section>
      </div>
    </StaticPageShell>
  );
}
