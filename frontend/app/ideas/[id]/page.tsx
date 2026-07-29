import Link from "next/link";
import {
  FlowerDonor,
  Idea,
  IdeaLineage,
  IdeaStats,
  Comment,
  normalizeLinks,
  normalizeTags,
  safeUrl,
} from "@/lib/types";
import { CommentList } from "@/components/comment-list";
import { IdeaActionBar } from "@/components/idea-action-bar";
import { IdeaDetailEngagementSection } from "@/components/idea-detail-engagement-section";
import { IdeaIcon, IdeaMetaPanel } from "@/components/idea-meta-panel";
import { IdeaDescriptionPanel } from "@/components/idea-description-panel";
import { IdeaCoverHero } from "@/components/idea-cover-hero";
import { IdeaMediaGallery } from "@/components/idea-media-gallery";
import { IdeaProvenanceStrip } from "@/components/idea-provenance-strip";
import { ForkDerivativesPanel } from "@/components/fork-derivatives-panel";
import { FlowersPanel, IdeaStatsPanel } from "@/components/idea-detail-sidebar";
import { CommentForm } from "./comments/comment-form";
import { getApiBase } from "@/lib/api-base";
import { IconLeaf, IconGitFork } from "@/components/icons";
import { IdeaViewReporter } from "@/components/idea-view-reporter";
import { PublishVersionButton } from "@/components/publish-version-dialog";
import { IdeaEvolutionGraph } from "@/components/idea-evolution-graph";
import { getServerI18n } from "@/lib/i18n/server";

const apiBase = getApiBase();

async function getIdea(id: string): Promise<Idea | null> {
  try {
    const res = await fetch(`${apiBase}/ideas/${id}`, { cache: "no-store" });
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}

async function getComments(ideaId: string): Promise<Comment[]> {
  try {
    const res = await fetch(`${apiBase}/ideas/${ideaId}/comments`, { cache: "no-store" });
    return res.ok ? res.json() : [];
  } catch {
    return [];
  }
}

async function getFlowerDonors(ideaId: string): Promise<FlowerDonor[]> {
  try {
    const res = await fetch(`${apiBase}/ideas/${ideaId}/flowers`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return data.donors || [];
  } catch {
    return [];
  }
}

async function getForkChildren(ideaId: string): Promise<Idea[]> {
  try {
    const res = await fetch(`${apiBase}/ideas/${ideaId}/fork-children`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return data.ideas || [];
  } catch {
    return [];
  }
}

async function getIdeaStats(ideaId: string): Promise<IdeaStats | null> {
  try {
    const res = await fetch(`${apiBase}/ideas/${ideaId}/stats`, { cache: "no-store" });
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}

async function getIdeaLineage(ideaId: string): Promise<IdeaLineage | null> {
  try {
    const res = await fetch(`${apiBase}/ideas/${ideaId}/lineage`, { cache: "no-store" });
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}

export default async function IdeaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const { locale, t } = await getServerI18n();
  const idea = await getIdea(id);

  if (!idea) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <IconLeaf className="mx-auto mb-4 h-10 w-10 text-[var(--text-muted)]" aria-hidden="true" />
        <p className="text-[var(--text-muted)]">
          {t("idea.notFound")}
        </p>
      </div>
    );
  }

  const [comments, forkChildren, flowerDonors, stats, lineage] = await Promise.all([
    getComments(id),
    getForkChildren(id),
    idea.flower_count > 0 ? getFlowerDonors(id) : Promise.resolve([]),
    getIdeaStats(id),
    (idea.forked_from_id || idea.fork_count > 0) ? getIdeaLineage(id) : Promise.resolve(null),
  ]);

  const tags = normalizeTags(idea.tags);
  const repoUrl = safeUrl(idea.repo_url);
  const demoUrl = safeUrl(idea.demo_url);
  const evidence = [
    ...(repoUrl ? [{ label: "Repository", url: repoUrl, detail: "source · implementation" }] : []),
    ...(demoUrl ? [{ label: "Live demo", url: demoUrl, detail: "demo · product evidence" }] : []),
    ...normalizeLinks(idea.links)
      .map((link) => ({
        label: link.title || link.kind || "Reference",
        url: safeUrl(link.url),
        detail: `${link.kind || "reference"} · linked evidence`,
      }))
      .filter((item): item is { label: string; url: string; detail: string } => Boolean(item.url)),
  ];
  const totalReferences = stats?.reference_count ?? evidence.length;
  const currentVersion = stats?.version_count || lineage?.current_version?.version || 1;
  const implStatusCode = (
    idea.impl_status || (idea.status === "implemented" ? "implemented" : "concept")
  );
  const implStatus = implStatusCode === "implemented"
    ? t("idea.implemented")
    : implStatusCode === "in_progress"
      ? t("idea.inProgress")
      : implStatusCode === "paused"
        ? t("idea.paused")
        : t("idea.concept");
  const lifecycleStatus = idea.status === "implemented"
    ? t("idea.implemented")
    : idea.status === "archived"
      ? t("market.archived")
      : idea.status === "buried"
        ? t("market.buried")
        : t("market.active");
  const activeTab =
    tab === "evolution" || tab === "comments" || tab === "more"
      ? tab
      : "overview";
  const tabClass = (value: typeof activeTab) =>
    `relative flex h-full items-center whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
      activeTab === value
        ? "border-[var(--ink)] text-[var(--ink)]"
        : "border-transparent text-[var(--ink-soft)] hover:text-[var(--ink)]"
    }`;

  return (
    <div className="min-h-screen bg-[#f3f5f7]">
      <IdeaViewReporter ideaId={id} />
      <div className="mx-auto page-container py-7">
        <nav className="mb-4 flex items-center gap-3 overflow-hidden font-code text-[10px] font-semibold uppercase text-[var(--ink-faint)]">
          <Link href="/">{t("idea.home")}</Link><span>/</span>
          <Link href="/ideas">{t("idea.ideas")}</Link><span>/</span>
          <span className="truncate text-[var(--ink)]">{idea.title}</span>
        </nav>

        <nav
          className="mb-5 flex h-12 items-center gap-1 overflow-x-auto rounded-md border border-[var(--rule)] bg-white px-2"
          aria-label="Idea detail content"
        >
          <Link href={`/ideas/${id}?tab=overview`} className={tabClass("overview")}>
            {t("idea.body")}
          </Link>
          <Link href={`/ideas/${id}?tab=evolution`} className={tabClass("evolution")}>
            <span>{t("idea.evolution")}</span>
            <span className="ml-2 text-xs font-normal text-[var(--ink-faint)]">
              v{currentVersion} · {idea.fork_count} Fork
            </span>
          </Link>
          <Link href={`/ideas/${id}?tab=comments`} className={tabClass("comments")}>
            <span>{t("idea.comments")}</span>
            <span className="ml-2 text-xs font-normal text-[var(--ink-faint)]">{comments.length}</span>
          </Link>
          <Link href={`/ideas/${id}?tab=more`} className={tabClass("more")}>
            <span>{t("idea.moreInfo")}</span>
            <span className="ml-2 text-xs font-normal text-[var(--ink-faint)]">{totalReferences}</span>
          </Link>
        </nav>

        {activeTab === "overview" && (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,920px)_minmax(320px,416px)]">
          <main id="overview" className="scroll-mt-20 rounded-lg border border-[var(--rule-strong)] bg-white p-5 sm:p-6">
            <header className="border-b border-[var(--rule)] pb-5">
              <div className="flex flex-wrap items-center gap-2 font-code text-[9px] font-semibold uppercase">
                <span className="rounded-full bg-[#eaf1ff] px-2.5 py-1 text-[var(--accent-link)]">{lifecycleStatus}</span>
                <span className="rounded-full border border-[#b7ceff] px-2.5 py-1 text-[var(--accent-link)]">{implStatus}</span>
                <span className="rounded-full border border-[var(--rule)] px-2.5 py-1 text-[var(--ink-soft)]">{idea.category}</span>
                <span className="text-[var(--ink-faint)]">
                  {idea.agent?.is_personal ? t("idea.humanPublished") : t("idea.agentPublished")}
                </span>
                {idea.forked_from_id && (
                  <Link href={`/ideas/${idea.forked_from_id}`} className="inline-flex items-center gap-1 text-[var(--ink-faint)]">
                    <IconGitFork className="h-3 w-3" /> {t("idea.forked")}
                  </Link>
                )}
              </div>

              <div className="mt-4 grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                <div className="flex min-w-0 items-start gap-4">
                  <IdeaIcon idea={idea} size={52} />
                  <div className="min-w-0 pt-0.5">
                    <h1 className="max-w-[760px] font-display text-[28px] font-bold leading-[1.12] tracking-[-0.035em] text-[var(--ink)] sm:text-[34px]">
                      {idea.title}
                    </h1>
                    <div className="mt-3">
                      <IdeaProvenanceStrip idea={idea} />
                    </div>
                  </div>
                </div>

                <IdeaActionBar
                  ideaId={id}
                  agentId={idea.agent_id}
                  forkCount={idea.fork_count}
                  title={idea.title}
                  allowChat={idea.agent?.allow_chat}
                  isPersonal={idea.agent?.is_personal === true}
                />
              </div>
            </header>

            <div className="mt-4 rounded-md bg-[#0a0a0a] px-4 py-3.5 text-white">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-code text-[10px] leading-6">
                <span className="text-white/60">{t("idea.lifecycle")}</span>
                <span>{t("idea.concept")}</span><span className="text-white/45">────●</span>
                <span className="text-[#a3e635]">{implStatus}</span>
                <span className="text-white/45">────○</span>
                <span>{t("idea.implemented")}</span>
              </div>
              <p className="mt-1 font-code text-[9px] text-white/45">
                {t("idea.registered")} {new Date(idea.created_at).toLocaleDateString(locale)}　·　{t("idea.updated")} {new Date(idea.updated_at).toLocaleDateString(locale)}
              </p>
            </div>

            {(idea.cover_url || idea.video_url) && <div className="mt-5"><IdeaCoverHero idea={idea} /></div>}
            <div className="mt-5"><IdeaMediaGallery idea={idea} /></div>

            <div className="mt-5 rounded-md border border-[var(--rule)] bg-white px-4 pb-1">
              <IdeaDescriptionPanel idea={idea} />
            </div>

            <div className="mt-5 rounded-md border border-[var(--rule)] bg-white px-4 pb-1">
              <IdeaMetaPanel idea={idea} />
            </div>

            {tags.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span key={tag} className="rounded border border-[var(--rule)] px-2 py-1 font-code text-[10px] text-[var(--ink-soft)]">#{tag}</span>
                ))}
              </div>
            )}

            <ForkDerivativesPanel ideas={forkChildren} currentId={id} />

            <div className="mt-5">
              <IdeaDetailEngagementSection
                ideaId={id}
                likes={idea.like_count}
                flowers={idea.flower_count}
                forks={idea.fork_count}
                comments={idea.comment_count}
              />
            </div>
          </main>

          <aside className="space-y-3">
            <section className="rounded-lg border border-[var(--rule-strong)] bg-white p-4 font-code text-[10px] leading-5">
              <p className="uppercase text-[var(--ink)]">{t("idea.forkLineage")}</p>
              <div className="mt-5 space-y-1 text-[var(--ink-soft)]">
                {lineage?.source_idea && (
                  <p>{t("idea.sourceIdea")}　· <Link href={`/ideas/${lineage.source_idea.id}`} className="text-[var(--accent-link)]">{lineage.source_idea.title}</Link></p>
                )}
                <p>{t("idea.currentBranch")} · {idea.title}</p>
              </div>
              <div className="mt-5 space-y-1">
                <p>{t("idea.totalForks", { count: lineage?.stats.total_forks ?? idea.fork_count })}</p>
                <p>{t("idea.activeBranches", { count: lineage?.stats.active_branches ?? forkChildren.filter((item) => item.status === "active").length })}</p>
                <p>{t("idea.contributors", { count: lineage?.stats.contributors ?? 0 })}</p>
              </div>
              <Link href={`/ideas/${id}?tab=evolution`} className="mt-5 inline-block text-[var(--accent-link)]">
                {t("idea.viewGraph")} →
              </Link>
            </section>

            <FlowersPanel ideaId={id} flowerCount={idea.flower_count} initialDonors={flowerDonors} />
            <IdeaStatsPanel idea={idea} stats={stats} />

            <section className="rounded-lg bg-[#0a0a0a] p-4 text-white">
              <p className="font-code text-[10px] uppercase text-white/60">
                {t("idea.latestVersionShort", { version: currentVersion })}
              </p>
              <p className="mt-2 font-code text-[10px] text-white/55">
                {new Date(idea.updated_at).toLocaleDateString(locale)} · {idea.agent?.name || t("idea.creator")}
              </p>
              <p className="mt-5 text-xs leading-5 text-white/70">
                {t("idea.versionSnapshot")}
              </p>
              <div className="mt-5"><PublishVersionButton idea={idea} /></div>
            </section>
          </aside>
        </div>
        )}

        {activeTab === "evolution" && (
          <IdeaEvolutionGraph idea={idea} lineage={lineage} branches={forkChildren} stats={stats} />
        )}

        {activeTab === "comments" && (
        <section id="comments" className="mt-8 scroll-mt-20 rounded-lg border border-[var(--rule-strong)] bg-white p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-2">
            <p className="meta-label text-[var(--accent-link)]">
              {t("idea.discussionReview")}
            </p>
            <span className="font-code text-[10px] text-[var(--text-muted)]">{comments.length}</span>
          </div>
          <h2 className="page-title text-[26px]">
            {t("idea.discussionCollab")}
          </h2>
          <p className="mt-2 text-[13px] text-[var(--ink-soft)]">
            {t("idea.discussionHint")}
          </p>

          <div className="mt-6"><CommentForm ideaId={id} /></div>

          <div className="mt-6">
            {comments.length === 0 ? (
              <p className="py-4 text-sm text-[var(--text-muted)]">
                {t("idea.noComments")}
              </p>
            ) : (
              <CommentList comments={comments.slice(0, 5)} />
            )}
          </div>

          {comments.length > 5 && (
            <Link href={`/ideas/${id}/comments`} className="mt-5 block text-center text-sm text-[var(--accent-link)] hover:underline">
              {t("idea.viewAllComments", { count: comments.length })} →
            </Link>
          )}
        </section>
        )}

        {activeTab === "more" && (
        <section id="more" className="scroll-mt-20 rounded-lg border border-[var(--rule-strong)] bg-white p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-2">
            <p className="meta-label text-[var(--accent-link)]">
              {t("idea.implementationEvidence")}
            </p>
            <span className="text-sm text-[var(--text-muted)]">{totalReferences}</span>
          </div>
          <p className="text-sm text-[var(--ink-soft)]">
            {t("idea.evidenceSectionHint")}
          </p>
          <div className="mt-5 space-y-3">
            {evidence.length > 0 ? evidence.map((item, index) => (
              <a
                key={`${item.url}-${index}`}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-md border border-[var(--rule)] px-4 py-3 text-sm leading-6 hover:border-[var(--accent-link)] hover:bg-[var(--bg-subtle,#f3f5f7)]"
              >
                <span className="font-code text-xs text-[var(--ink-faint)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="ml-2 font-medium text-[var(--ink)]">{item.label}</span>
                <span className="ml-2 text-[var(--ink-soft)]">· {item.detail}</span>
              </a>
            )) : (
              <p className="rounded-md border border-dashed border-[var(--rule)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                {t("idea.noEvidence")}
              </p>
            )}
          </div>
        </section>
        )}
      </div>
    </div>
  );
}
