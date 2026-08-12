import Link from "next/link";
import type { Idea, IdeaStats } from "@/lib/types";
import { PublishVersionButton } from "@/components/publish-version-dialog";
import { WireframeAvatar } from "@/components/wireframe-avatar";
import { DeimosIcon } from "@/components/deimos-icon";
import { EmptyState } from "@/components/empty-state";

export type EvidenceItem = {
  label: string;
  url: string;
  detail: string;
  kind?: "repo" | "demo" | "reference";
};

type IdeaMorePanelProps = {
  idea: Idea;
  evidence: EvidenceItem[];
  stats: IdeaStats | null;
  lifecycleStatus: string;
  implStatus: string;
  currentVersion: number;
  locale: string;
  labels: {
    title: string;
    subtitle: string;
    statusSection: string;
    conclusionReason: string;
    lifecycle: string;
    implProgress: string;
    registered: string;
    updated: string;
    signals: string;
    likes: string;
    wishes: string;
    flowers: string;
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
  stats,
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

  const conclusionReason =
    idea.status === "buried"
      ? idea.buried_reason
      : idea.status === "archived"
        ? idea.archived_reason
        : idea.status === "implemented"
          ? idea.implemented_reason
          : undefined;
  const conclusionAt =
    idea.status === "buried"
      ? idea.buried_at
      : idea.status === "archived"
        ? idea.archived_at
        : idea.status === "implemented"
          ? idea.implemented_at
          : undefined;

  const signalRows = [
    { label: labels.likes, value: stats?.like_count ?? idea.like_count },
    { label: labels.wishes, value: stats?.wish_count ?? idea.wish_count ?? 0 },
    { label: labels.flowers, value: stats?.flower_count ?? idea.flower_count },
    { label: labels.forks, value: stats?.fork_count ?? idea.fork_count },
    { label: labels.comments, value: stats?.comment_count ?? idea.comment_count },
    { label: labels.views, value: stats?.view_count ?? 0 },
    { label: labels.refs, value: stats?.reference_count ?? evidence.length },
  ];

  return (
    <section id="more" className="scroll-mt-24 space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--divider)] pb-4">
        <div>
          <h2 className="text-[18px] font-semibold tracking-tight text-[var(--ink)]">
            {labels.title}
          </h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-6 text-[var(--ink-soft)]">
            {labels.subtitle}
          </p>
        </div>
        <span className="text-[12px] tabular-nums text-[var(--ink-faint)]">
          v{currentVersion}
          {evidence.length > 0 ? ` · ${evidence.length}` : ""}
        </span>
      </header>

      <div className="surface-card p-5 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-8">
          {/* Status */}
          <div>
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
                <dd className="text-[12px] tabular-nums text-[var(--ink-soft)]">
                  {new Date(idea.created_at).toLocaleDateString(locale)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-[var(--ink-faint)]">{labels.updated}</dt>
                <dd className="text-[12px] tabular-nums text-[var(--ink-soft)]">
                  {new Date(idea.updated_at).toLocaleDateString(locale)}
                </dd>
              </div>
            </dl>
            {conclusionReason && (
              <div className="mt-3 rounded-[var(--radius-card)] bg-[var(--bg-subtle)] px-3 py-3">
                <p className="text-[11px] font-medium text-[var(--ink-faint)]">
                  {labels.conclusionReason}
                  {conclusionAt
                    ? ` · ${new Date(conclusionAt).toLocaleDateString(locale)}`
                    : ""}
                </p>
                <p className="mt-1.5 text-[13px] leading-6 text-[var(--ink)]">
                  {conclusionReason}
                </p>
              </div>
            )}
          </div>

          {/* Signals — flat cells, no nested boxes */}
          <div className="lg:border-l lg:border-[var(--divider)] lg:pl-8">
            <p className="meta-label mb-4">{labels.signals}</p>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
              {signalRows.map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-3 border-b border-[var(--rule-light)] pb-2">
                  <dt className="text-[12px] text-[var(--ink-faint)]">{row.label}</dt>
                  <dd className="text-[15px] font-semibold tabular-nums text-[var(--ink)]">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {/* Evidence — flat rows, no per-item cards */}
      <div className="surface-card p-5 sm:p-6">
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <h3 className="text-[15px] font-semibold text-[var(--ink)]">{labels.evidence}</h3>
          <span className="text-[12px] tabular-nums text-[var(--ink-faint)]">
            {evidence.length}
          </span>
        </div>
        <p className="text-[13px] text-[var(--ink-soft)]">{labels.evidenceHint}</p>

        {evidence.length > 0 ? (
          <ul className="mt-3 divide-y divide-[var(--rule-light)]">
            {evidence.map((item, index) => (
              <li key={`${item.url}-${index}`}>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group -mx-2 flex items-center gap-3 rounded-[var(--radius-btn)] px-2 py-3 transition-colors hover:bg-[var(--bg-subtle)]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-btn)] bg-[var(--bg-subtle)] text-[var(--ink-soft)] transition-colors group-hover:text-[var(--primary)]">
                    <EvidenceIcon kind={item.kind} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-medium text-[var(--ink)]">{item.label}</span>
                      <span className="text-[10px] text-[var(--ink-faint)]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-[var(--accent-link)]">
                      {hostLabel(item.url)}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-[var(--ink-faint)]">
                      {item.detail}
                    </span>
                  </span>
                  <span className="self-center text-[11px] font-medium text-[var(--ink-faint)] opacity-0 transition-opacity group-hover:opacity-100">
                    {labels.openLink} →
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon="evidence"
            title={labels.noEvidence}
            variant="dashed"
            className="mt-5"
          />
        )}
      </div>

      {/* Taxonomy + Maker — one surface, two columns */}
      <div className="surface-card p-5 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
          <div>
            <p className="meta-label mb-3">{labels.taxonomy}</p>
            <p className="mb-1.5 text-[12px] text-[var(--ink-faint)]">{labels.category}</p>
            {idea.category ? (
              <span className="inline-flex rounded-full border border-[var(--rule)] bg-[var(--bg-subtle)] px-3 py-1 text-[13px] font-medium text-[var(--ink)]">
                {idea.category}
              </span>
            ) : (
              <p className="text-[13px] text-[var(--ink-faint)]">{labels.noCategory}</p>
            )}
          </div>

          <div className="lg:border-l lg:border-[var(--divider)] lg:pl-8">
            <p className="meta-label mb-3">{labels.maker}</p>
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
          </div>
        </div>
      </div>

      {/* Version */}
      <div className="panel-inverse flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[13px] font-semibold text-white">
            {labels.versionLabel(currentVersion)}
          </p>
          <p className="mt-2 max-w-xl text-[13px] leading-6 text-white/70">
            {labels.versionHint}
          </p>
          <p className="mt-2 text-[11px] text-white/55">
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
