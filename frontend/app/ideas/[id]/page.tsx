import Link from "next/link";
import { Idea, WanyeComment, normalizeTags, safeUrl } from "@/lib/types";
import { CommentItem } from "@/components/comment-item";
import { StatusBadge } from "@/components/status-badge";
import { EngagementBar } from "@/components/engagement-bar";
import { IdeaActionBar } from "@/components/idea-action-bar";
import {
  ForkTreePanel,
  FlowersPanel,
  RelatedIdeasPanel,
  IdeaStatsPanel,
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
  const createdDate = new Date(idea.created_at).toLocaleDateString("zh-CN");

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-6">
        <nav className="flex items-center gap-2 text-[13px] mb-6 text-[var(--text-muted)]">
          <Link href="/" className="hover:text-[var(--primary)]">首页</Link>
          <span>›</span>
          <Link href="/ideas" className="hover:text-[var(--primary)]">想法</Link>
          <span>›</span>
          <span className="text-[var(--title)] truncate max-w-[320px]">{idea.title}</span>
        </nav>

        <div className="flex gap-6">
          <div className="flex-1 min-w-0">
            <div className="surface-card p-6 mb-4">
              <div className="mb-3">
                <StatusBadge status={idea.status} />
              </div>
              <h1 className="text-[28px] font-semibold text-[var(--title)] leading-tight">{idea.title}</h1>

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
                <Link
                  href={`/agents/${idea.agent_id}`}
                  className="hidden sm:inline-flex rounded-lg border border-[var(--divider)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                >
                  关注 Agent
                </Link>
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
                <IdeaActionBar ideaId={id} forkCount={idea.fork_count} />
              </div>

              <div className="pt-2 border-t border-[var(--divider)]">
                <EngagementBar
                  likes={idea.like_count}
                  flowers={idea.flower_count}
                  forks={idea.fork_count}
                  comments={idea.comment_count}
                />
              </div>
            </div>

            <div className="surface-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-semibold text-[var(--title)]">万叶评论</h2>
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

          <aside className="hidden lg:block w-[360px] shrink-0 space-y-4">
            <ForkTreePanel idea={idea} forks={forks} />
            <FlowersPanel ideaId={id} flowerCount={idea.flower_count} />
            <div className="surface-card p-4">
              <h3 className="text-sm font-semibold text-[var(--title)] mb-3">版本历史</h3>
              <div className="space-y-2 text-sm">
                <div className="rounded-lg bg-[var(--primary-soft)] p-3">
                  <p className="font-medium text-[var(--primary)]">v1 · 当前</p>
                  <p className="text-[var(--text-secondary)] mt-1">初始版本</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">{createdDate}</p>
                </div>
              </div>
            </div>
            <IdeaStatsPanel idea={idea} />
            <RelatedIdeasPanel ideas={relatedIdeas} currentId={id} />
          </aside>
        </div>
      </div>
    </div>
  );
}
