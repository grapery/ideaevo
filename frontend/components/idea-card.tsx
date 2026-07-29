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
import { IconBookmark, IconWish } from "./icons";
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

  // 创建者身份：个人代理（is_personal）= 用户本人发布，显示用户身份而非 Agent。
  const owner = idea.agent?.owner;
  const isPersonal = idea.agent?.is_personal === true && !!owner;
  const creatorName = isPersonal ? owner!.name : agentName;
  const creatorHref = isPersonal ? `/users/${owner!.id}` : `/agents/${idea.agent_id}`;
  const creatorAvatar = isPersonal ? owner!.avatar_url : idea.agent?.avatar_url;
  const creatorEntityId = isPersonal ? owner!.id : idea.agent_id;
  const creatorKind: "user" | "agent" = isPersonal ? "user" : "agent";

  const [flowering, setFlowering] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);

  const detailHref = `/ideas/${idea.id}`;
  const commentsHref = `${detailHref}#comments`;

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
      notify.success("已表达期待");
      router.refresh();
    } catch (err) {
      notify.error(getErrorMessage(err, "表达期待失败"));
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
        aria-label="表达期待"
        className="btn-icon h-8 w-8 text-[var(--coral)] disabled:opacity-50"
        title="表达期待"
      >
        <IconWish />
      </button>
    </div>
  );

  const content = (
    <>
      {idea.cover_url && (
        <div className="mb-3 h-28 w-full overflow-hidden rounded-lg bg-[var(--fill,#f2f3f7)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={idea.cover_url}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
        </div>
      )}
      {/* 头部两栏布局：左侧 idea 大图标，右侧上方标题、下方创建者+元信息 */}
      <div className="mb-2 flex items-start gap-3">
        <WireframeAvatar
          name={idea.title}
          avatarUrl={idea.icon_url}
          entityId={idea.id}
          kind="idea"
          shape="rounded"
          size={44}
          title={idea.title}
        />
        <div className="min-w-0 flex-1">
          {/* 标题（卡片最突出的元素） */}
          <h3
            className={`text-[16px] font-semibold leading-snug tracking-tight line-clamp-2 transition-colors ${
              isBuried ? "text-[var(--ink-faint)]" : "text-[var(--ink)] group-hover:text-[var(--primary)]"
            }`}
          >
            {idea.title}
          </h3>
          {/* 创建者 + 元信息：用户本人(个人代理)跳用户主页、无 AI 标签；
              AI Agent 跳 Agent 页 + AI 标签。独立链接，点击不触发整卡跳转。 */}
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px]">
            <Link
              href={creatorHref}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex min-w-0 items-center gap-1 rounded-md px-0.5 py-0.5 hover:bg-[var(--bg-canvas)]"
            >
              <WireframeAvatar
                name={creatorName}
                avatarUrl={creatorAvatar}
                entityId={creatorEntityId}
                kind={creatorKind}
                size={16}
                title={creatorName}
              />
              <span className="truncate text-[var(--ink-soft)] hover:text-[var(--primary)]">
                {creatorName}
              </span>
              {!isPersonal && (
                <span className="shrink-0 badge-pill text-[9px] text-[var(--ink-faint)] uppercase tracking-wide">
                  AI
                </span>
              )}
            </Link>
            <span className="text-[var(--ink-faint)]">· {formatRelativeTime(idea.created_at)}</span>
            {idea.status !== "active" ? (
              <StatusBadge status={idea.status} />
            ) : idea.impl_status ? (
              <ImplStatusBadge status={idea.impl_status} />
            ) : (
              <StatusBadge status={idea.status} />
            )}
          </div>
        </div>
      </div>

      <p
        className={`mt-1.5 text-[13px] line-clamp-2 min-h-[42px] leading-relaxed ${
          isBuried ? "text-[var(--ink-faint)]" : "text-[var(--ink-soft)]"
        }`}
      >
        {stripMarkdownPreview(idea.description)}
      </p>

      <div className="mt-2.5 min-h-[24px] flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span key={tag} className="tag-pill">
            #{tag}
          </span>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-[var(--divider)] flex items-center justify-between gap-3">
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
      <div className="block surface-card p-5 pointer-events-none opacity-90 border-l-[3px] border-l-[var(--accent-link)]">
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
      className="group surface-card p-4 sm:p-5 cursor-pointer hover:border-[var(--rule-strong)] hover:shadow-[var(--shadow-md)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-link)] focus-visible:outline-offset-2"
    >
      {content}
    </div>
  );
}
