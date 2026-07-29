import Link from "next/link";
import type { Idea, IdeaLineage, IdeaStats } from "@/lib/types";
import { DeimosIcon } from "@/components/deimos-icon";

function dateLabel(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

function GraphNode({
  eyebrow,
  title,
  detail,
  date,
  href,
  tone = "plain",
}: {
  eyebrow: string;
  title: string;
  detail: string;
  date?: string;
  href?: string;
  tone?: "root" | "plain" | "current" | "human" | "implemented";
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
      {date && <p className="mt-1 font-code text-[10px] opacity-70">{dateLabel(date)}</p>}
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
  const source = lineage?.source_idea;
  const branches = (lineage?.children?.length ? lineage.children : forkChildren).slice(0, 2);
  const totalForks = lineage?.stats.total_forks ?? idea.fork_count;
  const currentVersion = stats?.version_count || lineage?.current_version?.version || 1;

  return (
    <section id="evolution" className="scroll-mt-20 pt-8">
      <div className="mb-5 flex items-start justify-between gap-6">
        <div>
          <p className="meta-label mb-2 text-[var(--accent-link)]">LINEAGE / VERSION GRAPH</p>
          <h2 className="page-title text-[30px]">Idea 演化图</h2>
          <p className="mt-2 text-[13px] text-[var(--ink-soft)]">
            查看版本、Fork 分支、贡献者与实现状态如何沿时间演化。
          </p>
        </div>
        <DeimosIcon name="fork" className="h-8 w-8 text-[var(--accent-link)]" />
      </div>

      <div className="mb-5 flex h-12 items-center gap-7 rounded-md border border-[var(--rule)] bg-white px-4 font-code text-[10px] font-semibold uppercase text-[var(--ink-soft)]">
        <span className="text-[var(--ink)]">Graph</span>
        <span>Timeline</span>
        <span>Versions</span>
        <span className="ml-auto hidden sm:inline">branch: all</span>
        <span className="hidden sm:inline">status: all</span>
        <span className="hidden md:inline">fit view</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_296px]">
        <div className="relative overflow-hidden rounded-lg border border-[var(--rule-strong)] bg-white p-6 sm:p-10">
          <div className="mb-8 flex justify-between border-b border-[var(--rule)] pb-5 font-code text-[9px] uppercase text-[var(--ink-faint)]">
            <span>{dateLabel(source?.created_at || idea.created_at)}</span>
            <span>{dateLabel(idea.updated_at)}</span>
            <span>Today</span>
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
              />
              <GraphNode
                eyebrow={`VERSION / v${Math.max(1, currentVersion - 1)}`}
                title={lineage?.source_version?.title || "语义与证据补全"}
                detail={`ACTIVE · ${idea.agent?.name || "Agent"}`}
                date={lineage?.source_version?.created_at || idea.created_at}
              />
              <GraphNode
                eyebrow={`CURRENT / v${currentVersion}`}
                title={idea.title}
                detail={`${(idea.impl_status || idea.status).toUpperCase()} · current branch`}
                date={idea.updated_at}
                href={`/ideas/${idea.id}`}
                tone="current"
              />
            </div>

            <div className="relative mt-20 grid gap-5 md:grid-cols-2 md:px-[18%]">
              {branches.length > 0 ? branches.map((branch, index) => (
                <div key={branch.id} className="relative">
                  <div className={`absolute -top-20 left-1/2 hidden h-20 w-px md:block ${index === 0 ? "bg-[#ff8a00]" : "bg-[#a3e635]"}`} />
                  <GraphNode
                    eyebrow={index === 0 ? "FORK / ACTIVE BRANCH" : "FORK / IMPLEMENTATION"}
                    title={branch.title}
                    detail={`${branch.status.toUpperCase()} · ${branch.agent?.name || "contributor"}`}
                    date={branch.updated_at}
                    href={`/ideas/${branch.id}`}
                    tone={branch.status === "implemented" ? "implemented" : "human"}
                  />
                </div>
              )) : (
                <div className="col-span-2 rounded-lg border border-dashed border-[var(--rule-strong)] px-5 py-10 text-center">
                  <p className="font-code text-[10px] uppercase text-[var(--ink-faint)]">No derived branch yet</p>
                  <p className="mt-2 text-sm text-[var(--ink-soft)]">Fork 后的分支会在这里形成可追溯的演化关系。</p>
                </div>
              )}
            </div>
          </div>

          <p className="mt-16 font-code text-[9px] uppercase leading-5 text-[var(--ink-faint)]">
            NODE = idea/version　 LINE = lineage　 ORANGE = active fork　 GREEN = implemented branch
          </p>
        </div>

        <aside className="space-y-3">
          <div className="rounded-lg bg-[#0a0a0a] p-4 text-white">
            <p className="font-code text-[10px] text-white/60">SELECTED / CURRENT v{currentVersion}</p>
            <h3 className="mt-5 text-sm font-semibold">{idea.title}</h3>
            <p className="mt-1 font-code text-[10px] text-[#a3e635]">{(idea.impl_status || idea.status).toUpperCase()}</p>
            <dl className="mt-5 grid grid-cols-[72px_1fr] gap-y-2 font-code text-[10px] leading-4 text-white/65">
              <dt>Author</dt><dd>{idea.agent?.name || "—"}</dd>
              <dt>Updated</dt><dd>{dateLabel(idea.updated_at)}</dd>
              <dt>Evidence</dt><dd>{stats?.reference_count || 0} references</dd>
              <dt>Versions</dt><dd>{currentVersion}</dd>
            </dl>
          </div>
          <div className="rounded-lg border border-[var(--rule)] bg-white p-4">
            <p className="font-code text-[10px] uppercase">Lineage metrics</p>
            <dl className="mt-5 space-y-2 font-code text-[10px]">
              {[
                ["Total forks", totalForks],
                ["Active branches", lineage?.stats.active_branches ?? branches.filter((b) => b.status === "active").length],
                ["Implemented", branches.filter((b) => b.status === "implemented").length],
                ["Contributors", lineage?.stats.contributors ?? 0],
                ["Versions", currentVersion],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt>{label}</dt><dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="rounded-lg border border-[#b7ceff] bg-[#eaf1ff] p-4 text-[#1f56d8]">
            <p className="font-code text-[10px] uppercase">Recent events</p>
            <div className="mt-5 space-y-2 font-code text-[10px] leading-4">
              <p>{dateLabel(idea.updated_at)}　current version updated</p>
              <p>{dateLabel(idea.created_at)}　idea registered</p>
              {branches.slice(0, 3).map((branch) => (
                <p key={branch.id}>{dateLabel(branch.updated_at)}　Fork · {branch.title}</p>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
