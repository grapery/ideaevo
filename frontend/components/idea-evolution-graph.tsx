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
    root: "border-[#0a0a0a] bg-[#0a0a0a] text-white",
    plain: "border-[var(--accent-link)] bg-white text-[var(--accent-link)]",
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
  const { locale } = useI18n();
  const zh = locale === "zh-CN";
  const source = lineage?.source_idea;
  const branches = (lineage?.children?.length ? lineage.children : forkChildren).slice(0, 2);
  const totalForks = lineage?.stats.total_forks ?? idea.fork_count;
  const currentVersion = stats?.version_count || lineage?.current_version?.version || 1;

  return (
    <section id="evolution" className="scroll-mt-20 pt-8">
      <div className="mb-5 flex items-start justify-between gap-6">
        <div>
          <p className="meta-label mb-2 text-[var(--accent-link)]">{zh ? "谱系 / 版本图" : "Lineage / Version graph"}</p>
          <h2 className="page-title text-[30px]">{zh ? "Idea 演化图" : "Idea evolution graph"}</h2>
          <p className="mt-2 text-[13px] text-[var(--ink-soft)]">
            {zh
              ? "查看版本、Fork 分支、贡献者与实现状态如何沿时间演化。"
              : "See how versions, fork branches, contributors, and implementation status evolve over time."}
          </p>
        </div>
        <DeimosIcon name="fork" className="h-8 w-8 text-[var(--accent-link)]" />
      </div>

      <div className="mb-5 flex h-12 items-center gap-7 rounded-md border border-[var(--rule)] bg-white px-4 font-code text-[10px] font-semibold uppercase text-[var(--ink-soft)]">
        <span className="text-[var(--ink)]">{zh ? "关系图" : "Graph"}</span>
        <span>{zh ? "时间线" : "Timeline"}</span>
        <span>{zh ? "版本" : "Versions"}</span>
        <span className="ml-auto hidden sm:inline">{zh ? "分支：全部" : "branch: all"}</span>
        <span className="hidden sm:inline">{zh ? "状态：全部" : "status: all"}</span>
        <span className="hidden md:inline">{zh ? "适应视图" : "fit view"}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_296px]">
        <div className="relative overflow-hidden rounded-lg border border-[var(--rule-strong)] bg-white p-6 sm:p-10">
          <div className="mb-8 flex justify-between border-b border-[var(--rule)] pb-5 font-code text-[9px] uppercase text-[var(--ink-faint)]">
            <span>{dateLabel(source?.created_at || idea.created_at, locale)}</span>
            <span>{dateLabel(idea.updated_at, locale)}</span>
            <span>{zh ? "今天" : "Today"}</span>
          </div>

          <div className="relative">
            <div className="absolute left-[12%] right-[12%] top-[64px] hidden h-0.5 bg-[#0a0a0a] md:block" />
            <div className="relative grid gap-5 md:grid-cols-3">
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
                title={lineage?.source_version?.title || (zh ? "语义与证据补全" : "Semantic and evidence enrichment")}
                detail={`${zh ? "活跃" : "ACTIVE"} · ${idea.agent?.name || "Agent"}`}
                date={lineage?.source_version?.created_at || idea.created_at}
                locale={locale}
              />
              <GraphNode
                eyebrow={`CURRENT / v${currentVersion}`}
                title={idea.title}
                detail={`${(idea.impl_status || idea.status).toUpperCase()} · ${zh ? "当前分支" : "current branch"}`}
                date={idea.updated_at}
                href={`/ideas/${idea.id}`}
                tone="current"
                locale={locale}
              />
            </div>

            <div className="relative mt-20 grid gap-5 md:grid-cols-2 md:px-[18%]">
              {branches.length > 0 ? branches.map((branch, index) => (
                <div key={branch.id} className="relative">
                  <div className={`absolute -top-20 left-1/2 hidden h-20 w-px md:block ${index === 0 ? "bg-[#ff8a00]" : "bg-[#a3e635]"}`} />
                  <GraphNode
                    eyebrow={index === 0
                      ? (zh ? "FORK / 活跃分支" : "FORK / ACTIVE BRANCH")
                      : (zh ? "FORK / 实现分支" : "FORK / IMPLEMENTATION")}
                    title={branch.title}
                    detail={`${branch.status.toUpperCase()} · ${branch.agent?.name || (zh ? "贡献者" : "contributor")}`}
                    date={branch.updated_at}
                    href={`/ideas/${branch.id}`}
                    tone={branch.status === "implemented" ? "implemented" : "human"}
                    locale={locale}
                  />
                </div>
              )) : (
                <div className="col-span-2 rounded-lg border border-dashed border-[var(--rule-strong)] px-5 py-10 text-center">
                  <p className="font-code text-[10px] uppercase text-[var(--ink-faint)]">
                    {zh ? "暂无派生分支" : "No derived branch yet"}
                  </p>
                  <p className="mt-2 text-sm text-[var(--ink-soft)]">
                    {zh ? "Fork 后的分支会在这里形成可追溯的演化关系。" : "Forked branches will form a traceable evolution graph here."}
                  </p>
                </div>
              )}
            </div>
          </div>

          <p className="mt-16 font-code text-[9px] uppercase leading-5 text-[var(--ink-faint)]">
            {zh
              ? "节点 = idea/版本　连线 = 谱系　橙色 = 活跃 Fork　绿色 = 已实现分支"
              : "NODE = idea/version　 LINE = lineage　 ORANGE = active fork　 GREEN = implemented branch"}
          </p>
        </div>

        <aside className="space-y-3">
          <div className="rounded-lg bg-[#0a0a0a] p-4 text-white">
            <p className="font-code text-[10px] text-white/60">{zh ? "已选择 / 当前" : "SELECTED / CURRENT"} v{currentVersion}</p>
            <h3 className="mt-5 text-sm font-semibold">{idea.title}</h3>
            <p className="mt-1 font-code text-[10px] text-[#a3e635]">{(idea.impl_status || idea.status).toUpperCase()}</p>
            <dl className="mt-5 grid grid-cols-[72px_1fr] gap-y-2 font-code text-[10px] leading-4 text-white/65">
              <dt>{zh ? "作者" : "Author"}</dt><dd>{idea.agent?.name || "—"}</dd>
              <dt>{zh ? "更新" : "Updated"}</dt><dd>{dateLabel(idea.updated_at, locale)}</dd>
              <dt>{zh ? "证据" : "Evidence"}</dt><dd>{stats?.reference_count || 0} {zh ? "条引用" : "references"}</dd>
              <dt>{zh ? "版本" : "Versions"}</dt><dd>{currentVersion}</dd>
            </dl>
          </div>
          <div className="rounded-lg border border-[var(--rule)] bg-white p-4">
            <p className="font-code text-[10px] uppercase">{zh ? "谱系指标" : "Lineage metrics"}</p>
            <dl className="mt-5 space-y-2 font-code text-[10px]">
              {[
                [zh ? "Fork 总数" : "Total forks", totalForks],
                [zh ? "活跃分支" : "Active branches", lineage?.stats.active_branches ?? branches.filter((b) => b.status === "active").length],
                [zh ? "已实现" : "Implemented", branches.filter((b) => b.status === "implemented").length],
                [zh ? "贡献者" : "Contributors", lineage?.stats.contributors ?? 0],
                [zh ? "版本" : "Versions", currentVersion],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt>{label}</dt><dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="rounded-lg border border-[#b7ceff] bg-[#eaf1ff] p-4 text-[#1f56d8]">
            <p className="font-code text-[10px] uppercase">{zh ? "最近事件" : "Recent events"}</p>
            <div className="mt-5 space-y-2 font-code text-[10px] leading-4">
              <p>{dateLabel(idea.updated_at, locale)}　{zh ? "当前版本已更新" : "current version updated"}</p>
              <p>{dateLabel(idea.created_at, locale)}　{zh ? "idea 已注册" : "idea registered"}</p>
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
