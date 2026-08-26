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
import { DeimosIcon } from "./deimos-icon";
import { IconBookmark, IconWish } from "./icons";
import { useIdeaActionAuth } from "@/lib/use-idea-action-auth";
import { useAuth } from "@/lib/auth-context";
import { useAuthModal } from "@/lib/auth-modal-context";
import { api } from "@/lib/api-client";
import { ideaRequestJson } from "@/lib/idea-request";
import { notify } from "./ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import { useI18n } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/i18n/messages";

function formatRelativeTime(
  dateStr: string,
  locale: Locale,
  t: (key: import("@/lib/i18n/messages").TranslationKey, values?: Record<string, string | number>) => string,
) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return t("common.justNow");
  if (hours < 24) return t("common.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return t("common.daysAgo", { count: days });
  return new Date(dateStr).toLocaleDateString(locale);
}

type IdeaCardProps = {
  idea: Idea;
  preview?: boolean;
  variant?: "default" | "market" | "compact";
  highlighted?: boolean;
};

export function IdeaCard({
  idea,
  preview = false,
  variant = "default",
  highlighted = false,
}: IdeaCardProps) {
  const router = useRouter();
  const { apiKey, canAct, useSession } = useIdeaActionAuth();
  const { user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const { locale, t } = useI18n();
  const tags = normalizeTags(idea.tags).slice(0, 3);
  const agentName = idea.agent?.name || idea.agent_id?.slice(0, 8) || t("activity.agent");
  const isBuried = idea.status === "buried";
  // 非 active 状态：禁用写入类互动（期待），保留收藏。
  const inactive = idea.status !== "active";

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
    router.push(label === "comment" ? commentsHref : detailHref);
  }

  async function sendFlower(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!canAct) {
      if (user) notify.error(t("idea.authRequired"));
      else openAuthModal({ returnUrl: detailHref });
      return;
    }
    setFlowering(true);
    try {
      await ideaRequestJson(`/ideas/${idea.id}/wish`, {
        method: "POST",
        apiKey: useSession ? undefined : apiKey,
        useSession,
      });
      notify.success(t("idea.wished"));
      router.refresh();
    } catch (err) {
      notify.error(getErrorMessage(err, t("idea.wishFailed")));
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
        notify.success(t("idea.bookmarked"));
      }
    } catch (err) {
      notify.error(getErrorMessage(err, t("idea.bookmarkFailed")));
    } finally {
      setBookmarking(false);
    }
  }

  if (variant === "market") {
    const lifecycleLabel =
      idea.status === "implemented"
        ? t("idea.implemented")
        : idea.status === "archived"
          ? t("market.archived")
          : idea.status === "buried"
            ? t("market.buried")
            : t("market.active");
    const implementationLabel = idea.impl_status === "implemented"
      ? t("idea.implemented")
      : idea.impl_status === "in_progress"
        ? t("idea.inProgress")
        : idea.impl_status === "paused"
          ? t("idea.paused")
          : t("idea.concept");

    return (
      <article
        role="link"
        tabIndex={0}
        onClick={goDetail}
        onKeyDown={onCardKeyDown}
        aria-label={`${t("idea.body")}: ${idea.title}`}
        className={`group relative min-h-[170px] cursor-pointer overflow-hidden surface-card px-5 py-4 hover:border-[var(--rule-strong)] hover:bg-[var(--bg-hover)] hover:shadow-[var(--shadow-md)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-link)] focus-visible:outline-offset-2 ${
          highlighted
            ? "min-h-[190px] border-[var(--rule-strong)] bg-[var(--bg-subtle)] before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:rounded-r-full before:bg-[var(--action)]"
            : ""
        }`}
      >
        <div className="flex items-center gap-4 text-[11px] font-medium">
          <Link
            href={creatorHref}
            onClick={(event) => event.stopPropagation()}
            className={isPersonal ? "text-[var(--primary)] hover:underline" : "text-[var(--accent-link)] hover:underline"}
          >
            {isPersonal ? t("idea.humanPublished") : t("idea.agentBadge")} · {creatorName}
          </Link>
          <span className="inline-flex items-center gap-1 text-[var(--ink-soft)]">
            <DeimosIcon name="lifecycle" className="h-3 w-3" />
            {/* active 是列表默认态，不作为前缀噪声；非默认生命周期才展示 */}
            {idea.status === "active" ? implementationLabel : `${lifecycleLabel} / ${implementationLabel}`}
          </span>
        </div>

        <div className="mt-3 flex items-start gap-3">
          <WireframeAvatar
            kind="idea"
            entityId={idea.id}
            avatarUrl={idea.icon_url}
            name={idea.title}
            size={42}
            className="mt-0.5"
          />
          <h3 className="font-display line-clamp-2 text-[20px] font-bold leading-[28px] tracking-[-0.02em] text-[var(--ink)] group-hover:text-[var(--accent-link)]">
            {idea.title}
          </h3>
        </div>
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-[20px] text-[var(--ink-soft)]">
          {stripMarkdownPreview(idea.description)}
        </p>

        <div className="mt-3 flex min-h-[20px] flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="tag-pill">
              #{tag}
            </span>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-[12px] text-[var(--ink-soft)]">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEngagementItem("LIKE");
            }}
            aria-label={`${t("idea.statLikes")} ${idea.like_count}`}
            className="inline-flex items-center gap-1 hover:text-[var(--accent-link)]"
          >
            <DeimosIcon name="heart" className="h-3.5 w-3.5" />
            {idea.like_count}
          </button>
          <button
            type="button"
            onClick={sendFlower}
            disabled={inactive || flowering}
            aria-label={`${t("idea.statWishes")} ${idea.wish_count ?? idea.flower_count}`}
            className="inline-flex items-center gap-1 hover:text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <DeimosIcon name="wish" className="h-3.5 w-3.5" />
            {idea.wish_count ?? idea.flower_count}
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEngagementItem("Fork");
            }}
            aria-label={`${t("idea.statForks")} ${idea.fork_count}`}
            className="inline-flex items-center gap-1 hover:text-[var(--accent-link)]"
          >
            <DeimosIcon name="fork" className="h-3.5 w-3.5" />
            {idea.fork_count}
          </button>
          {idea.comment_count > 0 && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onEngagementItem("comment");
              }}
              aria-label={`${t("idea.statComments")} ${idea.comment_count}`}
              className="inline-flex items-center gap-1 hover:text-[var(--accent-link)]"
            >
              <DeimosIcon name="comment" className="h-3.5 w-3.5" />
              {idea.comment_count}
            </button>
          )}
          {(idea.suggestion_count ?? 0) > 0 && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                router.push(detailHref + "?tab=suggestions");
              }}
              aria-label={t("market.suggestionChip", { count: idea.suggestion_count ?? 0 })}
              title={t("market.suggestionChip", { count: idea.suggestion_count ?? 0 })}
              className="inline-flex items-center gap-1 hover:text-[var(--primary)]"
            >
              <DeimosIcon name="lifecycle" className="h-3.5 w-3.5" />
              {idea.suggestion_count}
            </button>
          )}
          <span className="ml-auto text-[var(--ink-faint)]">{formatRelativeTime(idea.created_at, locale, t)}</span>
        </div>
      </article>
    );
  }

  if (variant === "compact") {
    return (
      <article
        role="link"
        tabIndex={0}
        onClick={goDetail}
        onKeyDown={onCardKeyDown}
        aria-label={`${t("idea.body")}: ${idea.title}`}
        className="group card-listing cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-link)] focus-visible:outline-offset-2"
      >
        <WireframeAvatar
          kind="idea"
          entityId={idea.id}
          avatarUrl={idea.icon_url}
          name={idea.title}
          size={40}
          className="h-10 w-10 shrink-0 rounded-[8px]"
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14px] font-semibold leading-tight text-[var(--ink)] group-hover:text-[var(--accent-link)]">
            {idea.title}
          </h3>
          <p className="mt-0.5 line-clamp-1 text-[12px] leading-snug text-[var(--ink-faint)]">
            {stripMarkdownPreview(idea.description)}
          </p>
        </div>
        <DeimosIcon
          name="chevron-right"
          className="h-4 w-4 shrink-0 text-[var(--ink-faint)] opacity-0 transition-opacity group-hover:opacity-100"
        />
      </article>
    );
  }

  // 快捷操作仅用于 default 变体
  const quickActions = (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        onClick={toggleBookmark}
        disabled={bookmarking}
        aria-label={bookmarked ? t("idea.unbookmark") : t("idea.bookmark")}
        aria-pressed={bookmarked}
        className={`btn-icon h-8 w-8 disabled:opacity-50 ${bookmarked ? "text-[var(--primary)]" : ""}`}
        title={bookmarked ? t("idea.unbookmark") : t("idea.bookmark")}
      >
        <IconBookmark filled={bookmarked} />
      </button>
      <button
        type="button"
        onClick={sendFlower}
        disabled={inactive || flowering}
        aria-label={t("idea.wishForThis")}
        className="btn-icon h-8 w-8 text-[var(--coral)] disabled:opacity-50"
        title={t("idea.wishForThis")}
      >
        <IconWish />
      </button>
    </div>
  );

  const content = (
    <>
      {idea.cover_url && (
        <div className="mb-3 h-28 w-full overflow-hidden rounded-lg bg-[var(--bg-subtle)]">
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
          shape="circle"
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
            <span className="text-[var(--ink-faint)]">· {formatRelativeTime(idea.created_at, locale, t)}</span>
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
          wishes={idea.wish_count ?? idea.flower_count}
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
      aria-label={`${t("idea.body")}: ${idea.title}`}
      className="group surface-card p-4 sm:p-5 cursor-pointer hover:border-[var(--rule-strong)] hover:shadow-[var(--shadow-md)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-link)] focus-visible:outline-offset-2"
    >
      {content}
    </div>
  );
}
