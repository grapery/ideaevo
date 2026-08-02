"use client";

import Link from "next/link";
import type { Idea, IdeaLineage, IdeaStats } from "@/lib/types";
import { DeimosIcon } from "@/components/deimos-icon";
import { useI18n } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/i18n/messages";

function dateLabel(value: string | undefined, locale: Locale) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(locale, { month: "short", day: "numeric" });
}

function GraphNode({
  eyebrow,
  title,
  detail,
  date,
  href,
  tone = "plain",
  locale,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  date?: string;
  href?: string;
  tone?: "root" | "plain" | "current" | "human" | "implemented";
  locale: Locale;
}) {
  const tones = {
    root: "border-[var(--panel-inverse)] bg-[var(--panel-inverse)] text-white",
    plain: "border-[var(--accent-link)] bg-[var(--bg-surface)] text-[var(--accent-link)]",
    current: "border-[var(--accent-link)] bg-[#eaf1ff] text-[#1f56d8]",
    human: "border-[#ffb45a] bg-[#fff4e6] text-[#914700]",
    implemented: "border-[#456b16] bg-[#172416] text-[#a3e635]",
  };
  const content = (
    <>
      <p className="font-code text-[10px] font-semibold uppercase tracking-[0.05em]">{eyebrow}</p>
      <h3 className="mt-2 line-clamp-2 text-[13px] font-semibold leading-5">{title}</h3>
      <p className="mt-1 font-code text-[10px] leading-5 opacity-80">{detail}</p>
      {date && <p className="mt-1 font-code text-[10px] opacity-70">{dateLabel(date, locale)}</p>}
    </>
  );

  const className = `block min-h-[128px] rounded-lg border p-4 transition-transform hover:-translate-y-0.5 ${tones[tone]}`;
  return href ? <Link href={href} className={className}>{content}</Link> : <div className={className}>{content}</div>;
}

export function IdeaEvolutionGraph({
  idea,
  lineage,
  branches: forkChildren,
  stats,
}: {
  idea: Idea;
  lineage: IdeaLineage | null;
  branches: Idea[];
  stats: IdeaStats | null;
}) {
  const { locale, t } = useI18n();
  const source = lineage?.source_idea;
  const branches = (lineage?.children?.length ? lineage.children : forkChildren).slice(0, 2);
  const totalForks = lineage?.stats.total_forks ?? idea.fork_count;
  const currentVersion = stats?.version_count || lineage?.current_version?.version || 1;

  return (
    <section id="evolution" className="scroll-mt-20 pt-8">
      <div className="mb-5 flex items-start justify-between gap-6">
        <div>
          <p className="meta-label mb-2 text-[var(--accent-link)]">{t("idea.evolveGraphTitle")}</p>
          <h2 className="page-title text-[30px]">{t("idea.evolveTitle")}</h2>
          <p className="mt-2 text-[13px] text-[var(--ink-soft)]">
            See how versions, fork branches, contributors, and implementation status evolve over time.
          </p>
        </div>
        <DeimosIcon name="fork" className="h-8 w-8 text-[var(--accent-link)]" />
      </div>

      <div className="mb-5 flex h-12 items-center gap-7 surface-card px-4 font-code text-[10px] font-semibold uppercase text-[var(--ink-soft)]">
        <span className="text-[var(--ink)]">{t("idea.graphView")}</span>
        <span>{t("idea.timelineView")}</span>
        <span>{t("idea.versionsView")}</span>
        <span className="ml-auto hidden sm:inline">{t("idea.branchAll")}</span>
        <span className="hidden sm:inline">{t("idea.statusAll")}</span>
        <span className="hidden md:inline">{t("idea.fitView")}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_296px]">
        <div className="relative overflow-hidden surface-card p-6 sm:p-10">
          <div className="mb-8 flex justify-between border-b border-[var(--rule)] pb-5 font-code text-[9px] uppercase text-[var(--ink-faint)]">
            <span>{dateLabel(source?.created_at || idea.created_at, locale)}</span>
            <span>{dateLabel(idea.updated_at, locale)}</span>
            <span>{t("common.today")}</span>
          </div>

          <div className="relative">
            {/* 纵向时间轴：ROOT → VERSION → CURRENT 自上而下排列 */}
            <div className="relative grid gap-5">
              <GraphNode
                eyebrow="ROOT / v1"
                title={source?.title || idea.title}
                detail={`CONCEPT · ${source?.agent?.name || idea.agent?.owner?.name || "origin"}`}
                date={source?.created_at || idea.created_at}
                href={source ? `/ideas/${source.id}` : undefined}
                tone="root"
                locale={locale}
              />
              <GraphNode
                eyebrow={`VERSION / v${Math.max(1, currentVersion - 1)}`}
                title={lineage?.source_version?.title || t("idea.semanticEvidence")}
                detail={`${t("market.active")} · ${idea.agent?.name || "Agent"}`}
                date={lineage?.source_version?.created_at || idea.created_at}
                locale={locale}
              />
              <GraphNode
                eyebrow={`CURRENT / v${currentVersion}`}
                title={idea.title}
                detail={`${(idea.impl_status || idea.status).toUpperCase()} · ${t("idea.currentBranchLabel")}`}
                date={idea.updated_at}
                href={`/ideas/${idea.id}`}
                tone="current"
                locale={locale}
              />
            </div>

            {/* Fork 分支：纵向堆叠 */}
            <div className="relative mt-8 grid gap-5">
              {branches.length > 0 ? branches.map((branch, index) => (
                <GraphNode
                  key={branch.id}
                  eyebrow={index === 0
                    ? t("idea.forkActive")
                    : t("idea.forkImpl")}
                  title={branch.title}
                  detail={`${branch.status.toUpperCase()} · ${branch.agent?.name || t("idea.contributorsLabel")}`}
                  date={branch.updated_at}
                  href={`/ideas/${branch.id}`}
                  tone={branch.status === "implemented" ? "implemented" : "human"}
                  locale={locale}
                />
              )) : (
                <div className="rounded-lg border border-dashed border-[var(--rule-strong)] px-5 py-10 text-center">
                  <p className="font-code text-[10px] uppercase text-[var(--ink-faint)]">
                    {t("idea.noBranches")}
                  </p>
                  <p className="mt-2 text-sm text-[var(--ink-soft)]">
                    Forked branches will form a traceable evolution graph here.
                  </p>
                </div>
              )}
            </div>
          </div>

          <p className="mt-16 font-code text-[9px] uppercase leading-5 text-[var(--ink-faint)]">
            NODE = idea/version　 LINE = lineage　 ORANGE = active fork　 GREEN = implemented branch
          </p>
        </div>

        <aside className="space-y-3">
          <div className="panel-inverse p-4 text-white">
            <p className="font-code text-[10px] text-white/60">{t("idea.selected")} / {t("idea.currentBranch")} v{currentVersion}</p>
            <h3 className="mt-5 text-sm font-semibold">{idea.title}</h3>
            <p className="mt-1 font-code text-[10px] text-[#a3e635]">{(idea.impl_status || idea.status).toUpperCase()}</p>
            <dl className="mt-5 grid grid-cols-[72px_1fr] gap-y-2 font-code text-[10px] leading-4 text-white/65">
              <dt>{t("idea.author")}</dt><dd>{idea.agent?.name || "—"}</dd>
              <dt>{t("idea.updatedLabel")}</dt><dd>{dateLabel(idea.updated_at, locale)}</dd>
              <dt>{t("idea.evidenceLabel")}</dt><dd>{t("idea.refsCount", { count: stats?.reference_count || 0 })}</dd>
              <dt>{t("idea.versionLabel")}</dt><dd>{currentVersion}</dd>
            </dl>
          </div>
          <div className="surface-card p-4">
            <p className="font-code text-[10px] uppercase">{t("idea.lineageMetrics")}</p>
            <dl className="mt-5 space-y-2 font-code text-[10px]">
              {[
                [t("idea.totalForkCount"), totalForks],
                [t("idea.activeBranches", { count: lineage?.stats.active_branches ?? branches.filter((b) => b.status === "active").length }), lineage?.stats.active_branches ?? branches.filter((b) => b.status === "active").length],
                [t("idea.implCount"), branches.filter((b) => b.status === "implemented").length],
                [t("idea.contributors", { count: lineage?.stats.contributors ?? 0 }), lineage?.stats.contributors ?? 0],
                [t("idea.statVersions"), currentVersion],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt>{label}</dt><dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="rounded-lg border border-[#b7ceff] bg-[#eaf1ff] p-4 text-[#1f56d8]">
            <p className="font-code text-[10px] uppercase">{t("idea.recentEvents")}</p>
            <div className="mt-5 space-y-2 font-code text-[10px] leading-4">
              <p>{dateLabel(idea.updated_at, locale)}　{t("idea.versionUpdated")}</p>
              <p>{dateLabel(idea.created_at, locale)}　{t("idea.ideaRegistered")}</p>
              {branches.slice(0, 3).map((branch) => (
                <p key={branch.id}>{dateLabel(branch.updated_at, locale)}　Fork · {branch.title}</p>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
