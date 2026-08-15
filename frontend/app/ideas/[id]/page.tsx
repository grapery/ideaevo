import Link from "next/link";
import {
  Idea,
  IdeaLineage,
  IdeaStats,
  Comment,
  FlowerSender,
  normalizeLinks,
  normalizeTags,
  safeUrl,
} from "@/lib/types";
import { DiscussionPanel } from "@/components/discussion-panel";
import { IdeaActionBar } from "@/components/idea-action-bar";
import { IdeaDetailEngagementSection } from "@/components/idea-detail-engagement-section";
import { IdeaIcon, IdeaMetaPanel } from "@/components/idea-meta-panel";
import { IdeaDescriptionPanel } from "@/components/idea-description-panel";
import { IdeaCoverHero } from "@/components/idea-cover-hero";
import { IdeaMediaGallery } from "@/components/idea-media-gallery";
import { IdeaProvenanceStrip } from "@/components/idea-provenance-strip";
import { ForkDerivativesPanel } from "@/components/fork-derivatives-panel";
import { FlowersPanel, IdeaStatsPanel } from "@/components/idea-detail-sidebar";
import { getApiBase } from "@/lib/api-base";
import { IconLeaf, IconGitFork } from "@/components/icons";
import { IdeaViewReporter } from "@/components/idea-view-reporter";
import { PublishVersionButton } from "@/components/publish-version-dialog";
import { ForkFlowGraph } from "@/components/fork-flow-graph";
import {
  IdeaDetailTabs,
  type IdeaDetailTab,
} from "@/components/idea-detail-tabs";
import { IdeaTabJump } from "@/components/idea-tab-jump";
import { IdeaMorePanel } from "@/components/idea-more-panel";
import { IdeaLifecycleRail } from "@/components/idea-lifecycle-rail";
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

async function getFlowerSenders(ideaId: string): Promise<FlowerSender[]> {
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

  const [comments, forkChildren, flowerSenders, stats, lineage] = await Promise.all([
    getComments(id),
    getForkChildren(id),
    idea.flower_count > 0 ? getFlowerSenders(id) : Promise.resolve([]),
    getIdeaStats(id),
    (idea.forked_from_id || idea.fork_count > 0) ? getIdeaLineage(id) : Promise.resolve(null),
  ]);

  const tags = normalizeTags(idea.tags);
  const repoUrl = safeUrl(idea.repo_url);
  const demoUrl = safeUrl(idea.demo_url);
  const evidence = [
    ...(repoUrl
      ? [{ label: t("idea.evidenceRepo"), url: repoUrl, detail: t("idea.evidenceRepoDetail"), kind: "repo" as const }]
      : []),
    ...(demoUrl
      ? [{ label: t("idea.evidenceDemo"), url: demoUrl, detail: t("idea.evidenceDemoDetail"), kind: "demo" as const }]
      : []),
    ...normalizeLinks(idea.links)
      .map((link) => ({
        label: link.title || link.kind || t("idea.evidenceReference"),
        url: safeUrl(link.url),
        detail: t("idea.evidenceReferenceDetail", {
          kind: link.kind || t("idea.evidenceReference"),
        }),
        kind: "reference" as const,
      }))
      .filter((item): item is { label: string; url: string; detail: string; kind: "reference" } =>
        Boolean(item.url),
      ),
  ];
  const totalReferences = stats?.reference_count ?? evidence.length;
  const moreTabCount =
    evidence.length +
    (idea.category ? 1 : 0) +
    tags.length +
    (stats?.version_count || lineage?.current_version?.version ? 1 : 0);
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
  const activeTab: IdeaDetailTab =
    tab === "evolution" || tab === "comments" || tab === "more"
      ? tab
      : "overview";

  return (
    <div className="page-shell-full">
      <IdeaViewReporter ideaId={id} />
      <div className="page-container page-pad">
        <nav className="mb-4 flex items-center gap-2 overflow-hidden text-[12px] text-[var(--ink-faint)]">
          <Link href="/" className="hover:text-[var(--ink)]">{t("idea.home")}</Link>
          <span>/</span>
          <Link href="/ideas" className="hover:text-[var(--ink)]">{t("idea.ideas")}</Link>
          <span>/</span>
          <span className="truncate text-[var(--ink)]">{idea.title}</span>
        </nav>

        {/* Persistent header — stays across tabs (GitHub repo page pattern) */}
        <header className="surface-card p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="badge-pill badge-implemented">{lifecycleStatus}</span>
            <span className="rounded-full border border-[var(--accent-link)]/25 bg-[var(--accent-link-light)] px-2.5 py-1 text-[var(--accent-link)]">
              {implStatus}
            </span>
            <span className="rounded-full border border-[var(--rule)] px-2.5 py-1 text-[var(--ink-soft)]">{idea.category}</span>
            <span className="text-[var(--ink-faint)]">
              {idea.agent?.is_personal ? t("idea.humanPublished") : t("idea.agentPublished")}
            </span>
            {idea.forked_from_id && (
              <Link href={`/ideas/${idea.forked_from_id}`} className="inline-flex items-center gap-1 text-[var(--ink-faint)] hover:text-[var(--accent-link)]">
                <IconGitFork className="h-3 w-3" /> {t("idea.forked")}
              </Link>
            )}
          </div>

          <div className="mt-4 grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex min-w-0 items-start gap-4">
              <IdeaIcon idea={idea} size={52} />
              <div className="min-w-0 pt-0.5">
                <h1 className="page-heading max-w-[var(--content-main)]">
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
              status={idea.status}
              allowChat={idea.agent?.allow_chat}
              isPersonal={idea.agent?.is_personal === true}
            />
          </div>
        </header>

        <div className="mt-4">
          <IdeaDetailTabs
            ideaId={id}
            initialTab={activeTab}
            tabs={[
              { key: "overview", label: t("idea.body") },
              {
                key: "evolution",
                label: t("idea.evolution"),
                count: `${currentVersion} · ${idea.fork_count}`,
              },
              {
                key: "comments",
                label: t("idea.comments"),
                count: comments.length,
              },
              {
                key: "more",
                label: t("idea.moreInfo"),
                count: moreTabCount || totalReferences,
              },
            ]}
            overview={
              <div className="app-grid-2 gap-5">
                <main id="overview" className="scroll-mt-24 space-y-5 surface-card p-5 sm:p-6">
                  <IdeaLifecycleRail idea={idea} />

                  {(idea.cover_url || idea.video_url) && <IdeaCoverHero idea={idea} />}
                  <IdeaMediaGallery idea={idea} />

                  <IdeaDescriptionPanel idea={idea} />

                  <IdeaMetaPanel idea={idea} />

                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <span key={tag} className="tag-pill">#{tag}</span>
                      ))}
                    </div>
                  )}

                  <ForkDerivativesPanel ideas={forkChildren} currentId={id} />

                  <IdeaDetailEngagementSection
                    ideaId={id}
                    likes={idea.like_count}
                    wishes={idea.wish_count ?? 0}
                    flowers={idea.flower_count}
                    forks={idea.fork_count}
                    comments={idea.comment_count}
                    status={idea.status}
                  />
                </main>

                <aside className="space-y-3">
                  <section className="surface-card p-4">
                    <p className="text-[12px] font-semibold text-[var(--ink)]">{t("idea.forkLineage")}</p>
                    <div className="mt-4 space-y-1.5 text-[12px] leading-5 text-[var(--ink-soft)]">
                      {lineage?.source_idea && (
                        <p>
                          {t("idea.sourceIdea")} ·{" "}
                          <Link href={`/ideas/${lineage.source_idea.id}`} className="text-[var(--accent-link)] hover:underline">
                            {lineage.source_idea.title}
                          </Link>
                        </p>
                      )}
                      <p>{t("idea.currentBranch")} · {idea.title}</p>
                    </div>
                    <div className="mt-4 space-y-1 font-code text-[11px] tabular-nums text-[var(--ink-faint)]">
                      <p>{t("idea.totalForks", { count: lineage?.stats.total_forks ?? idea.fork_count })}</p>
                      <p>{t("idea.activeBranches", { count: lineage?.stats.active_branches ?? forkChildren.filter((item) => item.status === "active").length })}</p>
                      <p>{t("idea.contributors", { count: lineage?.stats.contributors ?? 0 })}</p>
                    </div>
                    <IdeaTabJump
                      tab="evolution"
                      className="mt-4 text-[12px] text-[var(--accent-link)] hover:underline"
                    >
                      {t("idea.viewGraph")} →
                    </IdeaTabJump>
                  </section>

                  <FlowersPanel
                    ideaId={id}
                    flowerCount={idea.flower_count}
                    initialSenders={flowerSenders}
                  />
                  <IdeaStatsPanel idea={idea} stats={stats} />

                  <section className="panel-inverse p-4">
                    <p className="font-code text-[10px] uppercase panel-inverse-muted">
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
            }
            evolution={
              <div className="surface-card p-5 sm:p-6">
                <ForkFlowGraph idea={idea} lineage={lineage} children={forkChildren} />
              </div>
            }
            comments={
              <div className="surface-card p-5 sm:p-6">
                <DiscussionPanel
                  ideaId={id}
                  status={idea.status}
                  comments={comments}
                  makerIds={[
                    idea.agent_id,
                    idea.agent?.id,
                    idea.agent?.owner_user_id,
                    idea.agent?.owner?.id,
                  ].filter((v): v is string => !!v)}
                  initialVisible={8}
                />
              </div>
            }
            more={
              <IdeaMorePanel
                idea={idea}
                evidence={evidence}
                tags={tags}
                stats={stats}
                lineage={lineage}
                lifecycleStatus={lifecycleStatus}
                implStatus={implStatus}
                currentVersion={currentVersion}
                locale={locale}
                labels={{
                  title: t("idea.moreInfo"),
                  subtitle: t("idea.moreInfoSubtitle"),
                  statusSection: t("idea.statusArchive"),
                  conclusionReason: t("idea.conclusionReason"),
                  lifecycle: t("idea.lifecycle"),
                  implProgress: t("idea.implStatus"),
                  registered: t("idea.registered"),
                  updated: t("idea.updated"),
                  signals: t("idea.signalSnapshot"),
                  likes: t("idea.statLikes"),
                  wishes: t("idea.statWishes"),
                  flowers: t("idea.statFlowers"),
                  forks: t("idea.statForks"),
                  comments: t("idea.statComments"),
                  views: t("idea.statViews"),
                  refs: t("idea.statRefs"),
                  evidence: t("idea.implementationEvidence"),
                  evidenceHint: t("idea.evidenceSectionHint"),
                  noEvidence: t("idea.noEvidence"),
                  openLink: t("idea.openEvidence"),
                  taxonomy: t("idea.taxonomy"),
                  category: t("idea.category"),
                  tags: t("idea.tags"),
                  noCategory: t("idea.noCategory"),
                  noTags: t("idea.noTags"),
                  maker: t("idea.makerSection"),
                  postedBy: t("idea.postedByAgent"),
                  agentFallback: t("idea.creator"),
                  lineage: t("idea.forkLineage"),
                  sourceIdea: t("idea.sourceIdea"),
                  currentBranch: t("idea.currentBranch"),
                  totalForks: (count) => t("idea.totalForks", { count }),
                  activeBranches: (count) => t("idea.activeBranches", { count }),
                  viewGraph: t("idea.viewGraph"),
                  version: t("idea.versions"),
                  versionHint: t("idea.versionSnapshot"),
                  versionLabel: (version) => t("idea.latestVersionShort", { version }),
                }}
              />
            }
          />
        </div>
      </div>
    </div>
  );
}
