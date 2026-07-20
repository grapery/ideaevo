"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppLink as Link } from "./app-link";
import { Idea, normalizeTags } from "@/lib/types";
import { stripMarkdownPreview } from "@/lib/markdown-utils";
import { EngagementBar } from "./engagement-bar";
import { StatusBadge } from "./status-badge";
import { ImplStatusBadge } from "./impl-status-badge";
import { WireframeAvatar } from "./wireframe-avatar";
import { IconBookmark, IconFlower } from "./icons";
import { useIdeaActionAuth } from "@/lib/use-idea-action-auth";
import { useAuth } from "@/lib/auth-context";
import { useAuthModal } from "@/lib/auth-modal-context";
import { api } from "@/lib/api-client";
import { IDEA_AUTH_REQUIRED_MSG, ideaRequestJson } from "@/lib/idea-request";
import { notify } from "./ui/notify";
import { getErrorMessage } from "@/lib/api-error";

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "刚刚";
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(dateStr).toLocaleDateString("zh-CN");
}

export function IdeaCard({ idea, preview = false }: { idea: Idea; preview?: boolean }) {
  const router = useRouter();
  const { apiKey, canAct, useSession } = useIdeaActionAuth();
  const { user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const tags = normalizeTags(idea.tags).slice(0, 3);
  const agentName = idea.agent?.name || idea.agent_id?.slice(0, 8) || "Agent";
  const isBuried = idea.status === "buried";

  const [flowering, setFlowering] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);

  const detailHref = `/ideas/${idea.id}`;
  const agentHref = `/agents/${idea.agent_id}`;
  const commentsHref = `${detailHref}#wanye-comments`;

  function goDetail() {
    router.push(detailHref);
  }

  function onCardKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      goDetail();
    }
  }

  function onEngagementItem(label: string) {
    router.push(label === "评论" ? commentsHref : detailHref);
  }

  async function sendFlower(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!canAct) {
      if (user) notify.error(IDEA_AUTH_REQUIRED_MSG);
      else openAuthModal({ returnUrl: detailHref });
      return;
    }
    setFlowering(true);
    try {
      await ideaRequestJson(`/ideas/${idea.id}/flowers`, {
        method: "POST",
        apiKey: useSession ? undefined : apiKey,
        useSession,
      });
      notify.success("鲜花已送出！");
      router.refresh();
    } catch (err) {
      notify.error(getErrorMessage(err, "送花失败"));
    } finally {
      setFlowering(false);
    }
  }

  async function toggleBookmark(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      openAuthModal({ returnUrl: detailHref });
      return;
    }
    setBookmarking(true);
    try {
      if (bookmarked) {
        await api.unbookmarkIdea(idea.id);
        setBookmarked(false);
      } else {
        await api.bookmarkIdea(idea.id);
        setBookmarked(true);
        notify.success("已收藏");
      }
    } catch (err) {
      notify.error(getErrorMessage(err, "收藏失败"));
    } finally {
      setBookmarking(false);
    }
  }

  const quickActions = (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        onClick={toggleBookmark}
        disabled={bookmarking}
        aria-label={bookmarked ? "取消收藏" : "收藏"}
        aria-pressed={bookmarked}
        className={`btn-icon h-8 w-8 disabled:opacity-50 ${bookmarked ? "text-[var(--primary)]" : ""}`}
        title={bookmarked ? "取消收藏" : "收藏"}
      >
        <IconBookmark filled={bookmarked} />
      </button>
      <button
        type="button"
        onClick={sendFlower}
        disabled={flowering}
        aria-label="送花"
        className="btn-icon h-8 w-8 text-[var(--coral)] disabled:opacity-50"
        title="送一朵花"
      >
        <IconFlower />
      </button>
    </div>
  );

  const content = (
    <>
      <div className="flex items-center gap-2 mb-2">
        <WireframeAvatar
          name={idea.title}
          avatarUrl={idea.icon_url}
          entityId={idea.id}
          kind="idea"
          shape="rounded"
          size={32}
          title={idea.title}
        />
        {/* Agent 头像 + 名字：独立链接跳 Agent 主页，点击不触发整卡跳转 */}
        <Link
          href={agentHref}
          onClick={(e) => e.stopPropagation()}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-0.5 py-0.5 hover:bg-[var(--bg-canvas)]"
        >
          <WireframeAvatar
            name={agentName}
            avatarUrl={idea.agent?.avatar_url}
            entityId={idea.agent_id}
            kind="agent"
            size={20}
            title={agentName}
          />
          <span className="truncate text-[13px] font-medium text-[var(--ink)] hover:text-[var(--primary)]">
            {agentName}
          </span>
        </Link>
        <span className="meta-label normal-case tracking-normal shrink-0">· {formatRelativeTime(idea.created_at)}</span>
        {idea.status !== "active" ? (
          <StatusBadge status={idea.status} />
        ) : idea.impl_status ? (
          <ImplStatusBadge status={idea.impl_status} />
        ) : (
          <StatusBadge status={idea.status} />
        )}
      </div>

      <h3
        className={`text-[15px] font-semibold leading-snug tracking-tight transition-colors ${
          isBuried ? "text-[var(--ink-faint)]" : "text-[var(--ink)] group-hover:text-[var(--primary)]"
        }`}
      >
        {idea.title}
      </h3>

      <p
        className={`mt-1.5 text-[13px] line-clamp-2 leading-relaxed ${
          isBuried ? "text-[var(--ink-faint)]" : "text-[var(--ink-soft)]"
        }`}
      >
        {stripMarkdownPreview(idea.description)}
      </p>

      {tags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="tag-pill">
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-[var(--rule)] flex items-center justify-between gap-3">
        <EngagementBar
          likes={idea.like_count}
          flowers={idea.flower_count}
          forks={idea.fork_count}
          comments={idea.comment_count}
          showShare={false}
          onItemClick={onEngagementItem}
        />
        {quickActions}
      </div>
    </>
  );

  if (preview) {
    return (
      <div className="block surface-card p-4 pointer-events-none opacity-90 border-l-[3px] border-l-[var(--accent-link)]">
        {content}
      </div>
    );
  }

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={goDetail}
      onKeyDown={onCardKeyDown}
      aria-label={`查看想法：${idea.title}`}
      className="group surface-card p-4 sm:p-5 border-l-[3px] border-l-transparent rounded-[var(--radius-card)] hover:border-l-[var(--accent-link)] hover:bg-[var(--bg-subtle)] hover:shadow-[var(--shadow-float)] transition-all duration-150 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ink)] focus-visible:outline-offset-2"
    >
      {content}
    </div>
  );
}
