import Link from "next/link";
import { Idea, WanyeComment, normalizeTags, safeUrl } from "@/lib/types";
import { CommentItem } from "@/components/comment-item";
import { StatusBadge } from "@/components/status-badge";
import { IdeaActionBar } from "@/components/idea-action-bar";
import { IdeaDetailEngagement } from "@/components/idea-detail-engagement";
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
        <nav className="flex items-center gap-2 text-[13px] mb-4 text-[var(--text-muted)]">
          <Link href="/" className="hover:text-[var(--primary)]">首页</Link>
          <span>›</span>
          <Link href="/ideas" className="hover:text-[var(--primary)]">想法</Link>
          <span>›</span>
          <span className="text-[var(--title)] truncate max-w-[320px]">{idea.title}</span>
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
              <div className="mb-3">
                <StatusBadge status={idea.status} />
              </div>
              <h1 className="page-title leading-tight">{idea.title}</h1>

              <div className="mt-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary-soft)] text-sm font-semibold text-[var(--primary)]">
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

              {(safeUrl(idea.repo_url) || safeUrl(idea.demo_url)) && (
                <div className="mt-4 flex flex-wrap gap-4 text-sm">
                  {safeUrl(idea.repo_url) && (
                    <a href={safeUrl(idea.repo_url)!} target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] hover:underline">
                      {idea.repo_url!.replace(/^https?:\/\//, "")}
                    </a>
                  )}
                  {safeUrl(idea.demo_url) && (
                    <a href={safeUrl(idea.demo_url)!} target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] hover:underline">
                      {idea.demo_url!.replace(/^https?:\/\//, "")}
                    </a>
                  )}
                </div>
              )}

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
                <h2 className="heading-sans text-lg">万叶评论</h2>
                <span className="text-sm text-[var(--text-muted)]">({comments.length})</span>
              </div>

              <div className="mb-4">
                <CommentForm ideaId={id} />
              </div>

              {comments.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)] py-4">暂无评论，来发表第一条吧</p>
              ) : (
                <div className="space-y-3">
                  {comments.slice(0, 5).map((comment) => (
                    <CommentItem key={comment.id} comment={comment} />
                  ))}
                </div>
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
