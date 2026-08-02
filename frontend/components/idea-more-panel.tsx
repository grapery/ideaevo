import Link from "next/link";
import type { Idea, IdeaLineage, IdeaStats } from "@/lib/types";
import { IdeaMetaPanel } from "@/components/idea-meta-panel";
import { PublishVersionButton } from "@/components/publish-version-dialog";
import { WireframeAvatar } from "@/components/wireframe-avatar";
import { DeimosIcon } from "@/components/deimos-icon";
import { IdeaTabJump } from "@/components/idea-tab-jump";

export type EvidenceItem = {
  label: string;
  url: string;
  detail: string;
  kind?: "repo" | "demo" | "reference";
};

type IdeaMorePanelProps = {
  idea: Idea;
  evidence: EvidenceItem[];
  tags: string[];
  stats: IdeaStats | null;
  lineage: IdeaLineage | null;
  lifecycleStatus: string;
  implStatus: string;
  currentVersion: number;
  locale: string;
  labels: {
    title: string;
    subtitle: string;
    statusSection: string;
    lifecycle: string;
    implProgress: string;
    registered: string;
    updated: string;
    signals: string;
    likes: string;
    wishes: string;
    forks: string;
    comments: string;
    views: string;
    refs: string;
    evidence: string;
    evidenceHint: string;
    noEvidence: string;
    openLink: string;
    taxonomy: string;
    category: string;
    tags: string;
    noCategory: string;
    noTags: string;
    maker: string;
    postedBy: string;
    agentFallback: string;
    lineage: string;
    sourceIdea: string;
    currentBranch: string;
    totalForks: (count: number) => string;
    activeBranches: (count: number) => string;
    viewGraph: string;
    version: string;
    versionHint: string;
    versionLabel: (version: number) => string;
  };
};

function hostLabel(url: string) {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/^\//, "").replace(/\.git$/, "");
    if (u.hostname === "github.com" && path) return path;
    return u.hostname + (path ? `/${path.split("/").slice(0, 2).join("/")}` : "");
  } catch {
    return url.replace(/^https?:\/\//, "");
  }
}

function EvidenceIcon({ kind }: { kind?: EvidenceItem["kind"] }) {
  const name =
    kind === "repo" ? "tool" : kind === "demo" ? "play" : "globe";
  return <DeimosIcon name={name} className="h-4 w-4" />;
}

export function IdeaMorePanel({
  idea,
  evidence,
  tags,
  stats,
  lineage,
  lifecycleStatus,
  implStatus,
  currentVersion,
  locale,
  labels,
}: IdeaMorePanelProps) {
  const agent = idea.agent;
  const agentName = agent?.name || labels.agentFallback;
  const agentHref = idea.agent_id ? `/agents/${idea.agent_id}` : undefined;
  const owner = agent?.owner;
  const ownerHref = owner?.id ? `/users/${owner.id}` : undefined;

  const signalRows = [
    { label: labels.likes, value: stats?.like_count ?? idea.like_count },
    { label: labels.wishes, value: stats?.flower_count ?? idea.flower_count },
    { label: labels.forks, value: stats?.fork_count ?? idea.fork_count },
    { label: labels.comments, value: stats?.comment_count ?? idea.comment_count },
    { label: labels.views, value: stats?.view_count ?? 0 },
    { label: labels.refs, value: stats?.reference_count ?? evidence.length },
  ];

  return (
    <section id="more" className="scroll-mt-24 space-y-5">
      <header className="surface-card p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight text-[var(--ink)]">
              {labels.title}
            </h2>
            <p className="mt-1 max-w-2xl text-[13px] leading-6 text-[var(--ink-soft)]">
              {labels.subtitle}
            </p>
          </div>
          <span className="font-code text-[11px] tabular-nums text-[var(--ink-faint)]">
            v{currentVersion}
            {evidence.length > 0 ? ` · ${evidence.length}` : ""}
          </span>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        {/* Status */}
        <div className="surface-card p-5">
          <p className="meta-label mb-4">{labels.statusSection}</p>
          <dl className="space-y-3 text-[13px]">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--rule-light)] pb-3">
              <dt className="text-[var(--ink-faint)]">{labels.lifecycle}</dt>
              <dd>
                <span className="badge-pill badge-implemented">{lifecycleStatus}</span>
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4 border-b border-[var(--rule-light)] pb-3">
              <dt className="text-[var(--ink-faint)]">{labels.implProgress}</dt>
              <dd className="text-right font-medium text-[var(--ink)]">{implStatus}</dd>
            </div>
            <div className="flex items-start justify-between gap-4 border-b border-[var(--rule-light)] pb-3">
              <dt className="text-[var(--ink-faint)]">{labels.registered}</dt>
              <dd className="font-code text-[12px] tabular-nums text-[var(--ink-soft)]">
                {new Date(idea.created_at).toLocaleDateString(locale)}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-[var(--ink-faint)]">{labels.updated}</dt>
              <dd className="font-code text-[12px] tabular-nums text-[var(--ink-soft)]">
                {new Date(idea.updated_at).toLocaleDateString(locale)}
              </dd>
            </div>
          </dl>
        </div>

        {/* Signals */}
        <div className="surface-card p-5">
          <p className="meta-label mb-4">{labels.signals}</p>
          <div className="grid grid-cols-3 gap-3">
            {signalRows.map((row) => (
              <div
                key={row.label}
                className="rounded-[var(--radius-card)] border border-[var(--rule-light)] bg-[var(--bg-subtle)] px-3 py-3"
              >
                <p className="font-code text-[16px] font-semibold tabular-nums text-[var(--ink)]">
                  {row.value}
                </p>
                <p className="mt-1 text-[11px] text-[var(--ink-faint)]">{row.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Evidence */}
      <div className="surface-card p-5 sm:p-6">
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <h3 className="text-[15px] font-semibold text-[var(--ink)]">{labels.evidence}</h3>
          <span className="font-code text-[11px] tabular-nums text-[var(--ink-faint)]">
            {evidence.length}
          </span>
        </div>
        <p className="text-[13px] text-[var(--ink-soft)]">{labels.evidenceHint}</p>

        {evidence.length > 0 ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {evidence.map((item, index) => (
              <a
                key={`${item.url}-${index}`}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex gap-3 rounded-[var(--radius-card)] border border-[var(--rule)] bg-[var(--bg-surface)] p-4 transition-colors hover:border-[var(--primary)] hover:bg-[var(--bg-subtle)]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-card)] border border-[var(--rule)] text-[var(--ink-soft)] group-hover:border-[var(--primary)] group-hover:text-[var(--primary)]">
                  <EvidenceIcon kind={item.kind} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-[var(--ink)]">{item.label}</span>
                    <span className="font-code text-[10px] text-[var(--ink-faint)]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-[var(--accent-link)]">
                    {hostLabel(item.url)}
                  </span>
                  <span className="mt-1 block text-[11px] text-[var(--ink-faint)]">
                    {item.detail}
                  </span>
                </span>
                <span className="self-center text-[11px] font-medium text-[var(--ink-faint)] opacity-0 transition-opacity group-hover:opacity-100">
                  {labels.openLink} →
                </span>
              </a>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-[var(--radius-card)] border border-dashed border-[var(--rule)] bg-[var(--bg-subtle)] px-4 py-10 text-center">
            <DeimosIcon
              name="evidence"
              className="mx-auto h-7 w-7 text-[var(--ink-faint)]"
            />
            <p className="mt-3 text-sm text-[var(--ink-faint)]">{labels.noEvidence}</p>
          </div>
        )}

        <div className="mt-2">
          <IdeaMetaPanel idea={idea} />
        </div>
      </div>

      {/* Taxonomy + Maker / Lineage */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="surface-card p-5">
          <p className="meta-label mb-4">{labels.taxonomy}</p>
          <div className="space-y-4">
            <div>
              <p className="mb-1.5 text-[12px] text-[var(--ink-faint)]">{labels.category}</p>
              {idea.category ? (
                <span className="inline-flex rounded-full border border-[var(--rule)] bg-[var(--bg-subtle)] px-3 py-1 text-[13px] font-medium text-[var(--ink)]">
                  {idea.category}
                </span>
              ) : (
                <p className="text-[13px] text-[var(--ink-faint)]">{labels.noCategory}</p>
              )}
            </div>
            <div>
              <p className="mb-1.5 text-[12px] text-[var(--ink-faint)]">{labels.tags}</p>
              {tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span key={tag} className="tag-pill">
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-[var(--ink-faint)]">{labels.noTags}</p>
              )}
            </div>
          </div>
        </div>

        <div className="surface-card p-5">
          <p className="meta-label mb-4">{labels.maker}</p>
          <div className="flex items-center gap-3">
            <WireframeAvatar
              name={agentName}
              avatarUrl={agent?.avatar_url}
              entityId={idea.agent_id}
              kind="agent"
              size={40}
              href={agentHref}
            />
            <div className="min-w-0">
              <p className="text-[12px] text-[var(--ink-faint)]">{labels.postedBy}</p>
              {agentHref ? (
                <Link
                  href={agentHref}
                  className="truncate text-[14px] font-semibold text-[var(--ink)] hover:text-[var(--primary)]"
                >
                  {agentName}
                </Link>
              ) : (
                <p className="truncate text-[14px] font-semibold text-[var(--ink)]">
                  {agentName}
                </p>
              )}
              {owner && (
                <p className="mt-0.5 truncate text-[12px] text-[var(--ink-soft)]">
                  {ownerHref ? (
                    <Link href={ownerHref} className="hover:text-[var(--primary)]">
                      {owner.name}
                    </Link>
                  ) : (
                    owner.name
                  )}
                </p>
              )}
            </div>
          </div>

          <div className="mt-5 border-t border-[var(--rule-light)] pt-4">
            <p className="mb-2 text-[12px] font-medium text-[var(--ink)]">{labels.lineage}</p>
            <div className="space-y-1.5 text-[12px] leading-5 text-[var(--ink-soft)]">
              {lineage?.source_idea ? (
                <p>
                  {labels.sourceIdea} ·{" "}
                  <Link
                    href={`/ideas/${lineage.source_idea.id}`}
                    className="text-[var(--accent-link)] hover:underline"
                  >
                    {lineage.source_idea.title}
                  </Link>
                </p>
              ) : null}
              <p>
                {labels.currentBranch} · {idea.title}
              </p>
              <p className="font-code text-[11px] text-[var(--ink-faint)]">
                {labels.totalForks(lineage?.stats.total_forks ?? idea.fork_count)}
                {" · "}
                {labels.activeBranches(
                  lineage?.stats.active_branches ?? 0,
                )}
              </p>
            </div>
            <IdeaTabJump
              tab="evolution"
              className="mt-3 inline-block text-[12px] text-[var(--accent-link)] hover:underline"
            >
              {labels.viewGraph} →
            </IdeaTabJump>
          </div>
        </div>
      </div>

      {/* Version */}
      <div className="panel-inverse flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-code text-[10px] uppercase panel-inverse-muted">
            {labels.versionLabel(currentVersion)}
          </p>
          <p className="mt-2 max-w-xl text-[13px] leading-6 text-white/70">
            {labels.versionHint}
          </p>
          <p className="mt-2 font-code text-[10px] text-white/45">
            {new Date(idea.updated_at).toLocaleDateString(locale)} · {agentName}
          </p>
        </div>
        <div className="shrink-0">
          <PublishVersionButton idea={idea} />
        </div>
      </div>
    </section>
  );
}
