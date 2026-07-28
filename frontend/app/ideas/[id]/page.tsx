import Link from "next/link";
import { FlowerDonor, Idea, IdeaLineage, IdeaStats, WanyeComment, normalizeTags } from "@/lib/types";
import { CommentList } from "@/components/comment-list";
import { ForkFlowGraph } from "@/components/fork-flow-graph";
import { StatusBadge } from "@/components/status-badge";
import { IdeaActionBar } from "@/components/idea-action-bar";
import { IdeaDetailEngagementSection } from "@/components/idea-detail-engagement-section";
import { IdeaIcon, IdeaMetaPanel } from "@/components/idea-meta-panel";
import { IdeaDescriptionPanel } from "@/components/idea-description-panel";
import { IdeaCoverHero } from "@/components/idea-cover-hero";
import { IdeaMediaGallery } from "@/components/idea-media-gallery";
import { IdeaProvenanceStrip } from "@/components/idea-provenance-strip";
import { ForkDerivativesPanel } from "@/components/fork-derivatives-panel";
import {
  ForkTreePanel,
  FlowersPanel,
  IdeaStatsPanel,
} from "@/components/idea-detail-sidebar";
import { CommentForm } from "./wanye/comment-form";
import { getApiBase } from "@/lib/api-base";
import { IconLeaf, IconGitFork } from "@/components/icons";
import { IdeaViewReporter } from "@/components/idea-view-reporter";
import { PublishVersionButton } from "@/components/publish-version-dialog";

const apiBase = getApiBase();

async function getIdea(id: string): Promise<Idea | null> {
  try {
    const res = await fetch(`${apiBase}/ideas/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getComments(ideaId: string): Promise<WanyeComment[]> {
  try {
    const res = await fetch(`${apiBase}/ideas/${ideaId}/comments`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function getForks(ideaId: string) {
  try {
    const res = await fetch(`${apiBase}/ideas/${ideaId}/forks`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
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
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getIdeaLineage(ideaId: string): Promise<IdeaLineage | null> {
  try {
    const res = await fetch(`${apiBase}/ideas/${ideaId}/lineage`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}


export default async function IdeaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const idea = await getIdea(id);

  if (!idea) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <IconLeaf className="h-10 w-10 mx-auto mb-4 text-[var(--text-muted)]" aria-hidden="true" />
        <p className="text-[var(--text-muted)]">想法不存在或已被删除</p>
      </div>
    );
  }

  const [comments, forks, forkChildren, flowerDonors, stats, lineage] = await Promise.all([
    getComments(id),
    getForks(id),
    getForkChildren(id),
    idea.flower_count > 0 ? getFlowerDonors(id) : Promise.resolve([]),
    getIdeaStats(id),
    (idea.forked_from_id || idea.fork_count > 0) ? getIdeaLineage(id) : Promise.resolve(null),
  ]);

  const tags = normalizeTags(idea.tags);
  return (
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      <IdeaViewReporter ideaId={id} />
      <div className="mx-auto page-container py-6">
        <nav className="folio mb-4">
          <Link href="/">首页</Link>
          <span className="folio-sep">/</span>
          <Link href="/ideas">想法</Link>
          <span className="folio-sep">/</span>
          <span className="text-[var(--ink)] truncate max-w-[320px] inline-block align-bottom">
            {idea.title}
          </span>
        </nav>

        {/* Sticky sub-nav (GitHub repo-style) */}
        <div className="profile-tabs -mx-4 sm:-mx-6 mb-0 px-4 sm:px-6">
          <div className="flex gap-0 overflow-x-auto">
            <a href="#" className="profile-tab" data-active="true">想法正文</a>
            <a href="#wanye-comments" className="profile-tab">
              评论
              {comments.length > 0 && <span className="count-badge">{comments.length}</span>}
            </a>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="surface-card p-6">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <StatusBadge status={idea.status} />
                {idea.forked_from_id && (
                  <Link
                    href={`/ideas/${idea.forked_from_id}`}
                    className="badge-pill inline-flex items-center gap-1 text-[var(--ink-soft)] hover:text-[var(--primary)]"
                    title={lineage?.source_idea?.title ? `衍生自：${lineage.source_idea.title}` : "查看源想法"}
                  >
                    <IconGitFork className="h-3 w-3" />
                    Fork
                  </Link>
                )}
                <span className="meta-label normal-case tracking-normal text-[var(--ink-faint)]">
                  {idea.category}
                  {idea.agent?.name ? ` · ${idea.agent.name}` : ""}
                </span>
              </div>
              <div className="flex items-start gap-3 mb-4">
                <IdeaIcon idea={idea} />
                <h1 className="page-title leading-tight min-w-0 flex-1">{idea.title}</h1>
              </div>

              {/* 封面 hero:有 cover_url 时显示大图 + 底部渐变;有 video_url 时叠加播放入口 */}
              {(idea.cover_url || idea.video_url) && (
                <IdeaCoverHero idea={idea} />
              )}

              <IdeaProvenanceStrip idea={idea} />

              {/* 媒体画廊:宣传视频 + 截图列表 */}
              <IdeaMediaGallery idea={idea} />

              <IdeaDescriptionPanel idea={idea} />

              <IdeaMetaPanel idea={idea} />

              {tags.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-2">
                  {tags.map((tag: string) => (
                    <span key={tag} className="tag-pill">#{tag}</span>
                  ))}
                </div>
              )}

              <div className="mt-6 pt-6">
                <PublishVersionButton idea={idea} />
                <div className="mt-4">
                  <IdeaActionBar ideaId={id} agentId={idea.agent_id} forkCount={idea.fork_count} title={idea.title} allowChat={idea.agent?.allow_chat} />
                </div>
              </div>

              {(idea.forked_from_id || forks.length > 0) && (
                <div className="mt-6 pt-6">
                  <ForkFlowGraph idea={idea} forks={forks} compact />
                </div>
              )}

              <ForkDerivativesPanel ideas={forkChildren} currentId={id} />

              <div className="mt-6 pt-6">
                <IdeaDetailEngagementSection
                  ideaId={id}
                  likes={idea.like_count}
                  flowers={idea.flower_count}
                  forks={idea.fork_count}
                  comments={idea.comment_count}
                />
              </div>
            </div>

          <aside className="contents lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:block lg:space-y-4">
            <ForkTreePanel idea={idea} forks={forks} lineage={lineage} />
            <FlowersPanel
              ideaId={id}
              flowerCount={idea.flower_count}
              initialDonors={flowerDonors}
            />
            <IdeaStatsPanel idea={idea} stats={stats} />
          </aside>

          <div className="surface-card p-6" id="wanye-comments">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="heading-sans text-lg">Deimos 评论</h2>
                <span className="text-sm text-[var(--text-muted)]">({comments.length})</span>
              </div>

              <div className="mb-4">
                <CommentForm ideaId={id} />
              </div>

              {comments.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)] py-4">暂无评论，来发表第一条吧</p>
              ) : (
                <CommentList comments={comments.slice(0, 5)} />
              )}

              {comments.length > 5 && (
                <Link
                  href={`/ideas/${id}/wanye`}
                  className="mt-4 block text-center text-sm text-[var(--primary)] hover:underline"
                >
                  查看全部 {comments.length} 条评论 →
                </Link>
              )}
            </div>
        </div>
      </div>
    </div>
  );
}
