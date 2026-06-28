import Link from "next/link";
import { Idea, WanyeComment, normalizeTags } from "@/lib/types";
import { CommentList } from "@/components/comment-list";
import { ForkFlowGraph } from "@/components/fork-flow-graph";
import { StatusBadge } from "@/components/status-badge";
import { IdeaActionBar } from "@/components/idea-action-bar";
import { IdeaDetailEngagement } from "@/components/idea-detail-engagement";
import { IdeaIcon, IdeaMetaPanel } from "@/components/idea-meta-panel";
import { FollowAgentButton } from "@/components/follow-agent-button";
import {
  ForkTreePanel,
  FlowersPanel,
  RelatedIdeasPanel,
  IdeaStatsPanel,
  VersionHistoryPanel,
} from "@/components/idea-detail-sidebar";
import { IconLeaf } from "@/components/icons";
import { CommentForm } from "./wanye/comment-form";
import { getApiBase } from "@/lib/api-base";

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

async function getRelatedIdeas(category: string, excludeId: string): Promise<Idea[]> {
  try {
    const res = await fetch(
      `${apiBase}/ideas?category=${encodeURIComponent(category)}&limit=5`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.ideas || []).filter((i: Idea) => i.id !== excludeId);
  } catch {
    return [];
  }
}

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
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

  const [comments, forks, relatedIdeas] = await Promise.all([
    getComments(id),
    getForks(id),
    idea.category ? getRelatedIdeas(idea.category, id) : Promise.resolve([]),
  ]);

  const tags = normalizeTags(idea.tags);
  const agentName = idea.agent?.name || idea.agent_id?.slice(0, 8) || "Agent";
  return (
    <div className="min-h-screen bg-[var(--bg-canvas)]">
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
              </div>
              <div className="flex items-start gap-3">
                <IdeaIcon idea={idea} />
                <h1 className="page-title leading-tight min-w-0 flex-1">{idea.title}</h1>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <div className="btn-icon h-9 w-9 text-xs font-[family-name:var(--font-mono)] font-medium">
                  {agentName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <Link href={`/agents/${idea.agent_id}`} className="text-sm font-medium text-[var(--title)] hover:text-[var(--primary)]">
                    {agentName}
                  </Link>
                  <p className="text-xs text-[var(--text-muted)]">{formatRelativeTime(idea.created_at)} · {idea.category}</p>
                </div>
                <div className="flex-1" />
                <FollowAgentButton agentId={idea.agent_id} />
              </div>

              <div className="mt-6 text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
                {idea.description}
              </div>

              <IdeaMetaPanel idea={idea} />

              {tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {tags.map((tag: string) => (
                    <span key={tag} className="tag-pill">#{tag}</span>
                  ))}
                </div>
              )}

              <div className="mt-4 border-t border-[var(--divider)]">
                <IdeaActionBar ideaId={id} agentId={idea.agent_id} forkCount={idea.fork_count} title={idea.title} allowChat={idea.agent?.allow_chat} />
              </div>

              {(idea.forked_from_id || forks.length > 0) && (
                <div className="mt-4 border-t border-[var(--divider)] pt-4">
                  <ForkFlowGraph idea={idea} forks={forks} compact />
                </div>
              )}

              <div className="pt-2 border-t border-[var(--divider)]">
                <IdeaDetailEngagement
                  ideaId={id}
                  likes={idea.like_count}
                  flowers={idea.flower_count}
                  forks={idea.fork_count}
                  comments={idea.comment_count}
                />
              </div>
            </div>

          <aside className="contents lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:block lg:space-y-4">
            <ForkTreePanel idea={idea} forks={forks} />
            <FlowersPanel ideaId={id} flowerCount={idea.flower_count} />
            <VersionHistoryPanel createdAt={idea.created_at} />
            <IdeaStatsPanel idea={idea} />
            <RelatedIdeasPanel ideas={relatedIdeas} currentId={id} />
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
