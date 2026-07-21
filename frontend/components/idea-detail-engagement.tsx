"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import {
  IDEA_AUTH_REQUIRED_MSG,
  ideaRequestJson,
} from "@/lib/idea-request";
import { useIdeaActionAuth } from "@/lib/use-idea-action-auth";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import { ReactionBar } from "./reaction-bar";
import { ReportDialog } from "./report-dialog";
import { IconBookmark, IconFlower, IconGitFork, IconHeart, IconMessage, IconShare } from "./icons";

export function IdeaDetailEngagement({
  ideaId,
  likes: initialLikes,
  flowers: initialFlowers,
  forks,
  comments,
  forkListOpen = false,
  onForkListToggle,
}: {
  ideaId: string;
  likes: number;
  flowers: number;
  forks: number;
  comments: number;
  forkListOpen?: boolean;
  onForkListToggle?: () => void;
}) {
  const { apiKey, canAct, useSession } = useIdeaActionAuth();
  const { user } = useAuth();
  const router = useRouter();
  const [likes, setLikes] = useState(initialLikes);
  const [flowers, setFlowers] = useState(initialFlowers);
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});
  const [myReaction, setMyReaction] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    setLikes(initialLikes);
    setFlowers(initialFlowers);
  }, [initialLikes, initialFlowers]);

  // 获取 emoji 反应计数 + 当前用户的选择
  useEffect(() => {
    ideaRequestJson<{ counts: Record<string, number>; mine: string }>(
      `/ideas/${ideaId}/reactions`,
      { apiKey: useSession ? undefined : apiKey, useSession }
    )
      .then((res) => {
        setReactionCounts(res.counts || {});
        setMyReaction(res.mine || "");
      })
      .catch(() => {});
  }, [ideaId, apiKey, useSession]);

  useEffect(() => {
    if (!canAct) return;
    ideaRequestJson<{ liked: boolean }>(`/ideas/${ideaId}/like`, {
      apiKey: useSession ? undefined : apiKey,
      useSession,
    })
      .then((res) => setLiked(res.liked))
      .catch(() => {});
  }, [ideaId, canAct, apiKey, useSession]);

  // 收藏状态（仅登录用户账户可用，后端要求 session user_id）
  useEffect(() => {
    if (!user) {
      setBookmarked(false);
      return;
    }
    api
      .getBookmarkStatus(ideaId)
      .then((res) => setBookmarked(res.bookmarked))
      .catch(() => {});
  }, [ideaId, user]);

  async function toggleBookmark() {
    if (!user) return;
    setLoading("bookmark");
    try {
      if (bookmarked) {
        await api.unbookmarkIdea(ideaId);
        setBookmarked(false);
      } else {
        await api.bookmarkIdea(ideaId);
        setBookmarked(true);
        notify.success("已收藏");
      }
    } catch (err) {
      notify.error(getErrorMessage(err, "收藏失败"));
    } finally {
      setLoading(null);
    }
  }

  async function toggleLike() {
    if (!canAct) {
      notify.error(IDEA_AUTH_REQUIRED_MSG);
      return;
    }
    setLoading("like");
    try {
      if (liked) {
        await ideaRequestJson(`/ideas/${ideaId}/like`, {
          method: "DELETE",
          apiKey: useSession ? undefined : apiKey,
          useSession,
        });
        setLiked(false);
        setLikes((n) => Math.max(0, n - 1));
      } else {
        await ideaRequestJson(`/ideas/${ideaId}/like`, {
          method: "POST",
          apiKey: useSession ? undefined : apiKey,
          useSession,
        });
        setLiked(true);
        setLikes((n) => n + 1);
        notify.success("已点赞");
      }
    } catch (err) {
      notify.error(getErrorMessage(err, "点赞失败"));
    } finally {
      setLoading(null);
    }
  }

  async function sendFlower() {
    if (!canAct) {
      notify.error(IDEA_AUTH_REQUIRED_MSG);
      return;
    }
    setLoading("flower");
    try {
      await ideaRequestJson(`/ideas/${ideaId}/flowers`, {
        method: "POST",
        apiKey: useSession ? undefined : apiKey,
        useSession,
      });
      setFlowers((n) => n + 1);
      notify.success("鲜花已送出！");
      // 刷新服务端数据，让「收到的花」头像列表与累计数同步更新
      router.refresh();
    } catch (err) {
      notify.error(getErrorMessage(err, "送花失败"));
    } finally {
      setLoading(null);
    }
  }

  function scrollToComments() {
    document.getElementById("wanye-comments")?.scrollIntoView({ behavior: "smooth" });
  }

  async function shareIdea() {
    const url = window.location.href;
    let shared = false;
    try {
      if (navigator.share) {
        await navigator.share({ url, title: document.title });
        shared = true;
      } else {
        await navigator.clipboard.writeText(url);
        shared = true;
        notify.success("链接已复制");
      }
    } catch {
      // 用户取消分享 (AbortError) 也会进这里，不计为分享成功
      notify.error("分享失败");
    }
    // 分享/复制成功后，向后端落库一次分享计数（fire-and-forget）
    if (shared && canAct) {
      api
        .shareIdea(ideaId, { apiKey: useSession ? undefined : apiKey, useSession })
        .catch(() => {});
    }
  }

  const actionBtn =
    "inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[13px] tabular-nums transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-[var(--bg-subtle)] active:scale-90 disabled:opacity-50";

  return (
    <div className="space-y-3">
      <ReactionBar
        ideaId={ideaId}
        initialCounts={reactionCounts}
        initialMine={myReaction}
      />
      <div className="flex items-center gap-5 text-[var(--text-secondary)]">
      <button
        type="button"
        onClick={toggleLike}
        disabled={loading === "like"}
        aria-label="点赞"
        aria-pressed={liked}
        className={`${actionBtn} ${liked ? "text-[var(--coral)]" : ""}`}
      >
        <IconHeart />
        <span>{likes}</span>
      </button>

      <button
        type="button"
        onClick={sendFlower}
        disabled={loading === "flower"}
        aria-label="送花"
        className={`${actionBtn} text-[var(--coral)]`}
      >
        <IconFlower />
        <span>{flowers}</span>
      </button>

      <button
        type="button"
        onClick={() => onForkListToggle?.()}
        disabled={!onForkListToggle}
        aria-label="查看 Fork 衍生想法"
        aria-expanded={forkListOpen}
        className={`${actionBtn} ${forkListOpen ? "bg-[var(--primary-soft)] text-[var(--primary)]" : ""}`}
      >
        <IconGitFork />
        <span>{forks}</span>
      </button>

      <button
        type="button"
        onClick={scrollToComments}
        aria-label="查看评论"
        className={actionBtn}
      >
        <IconMessage />
        <span>{comments}</span>
      </button>

      {user && (
        <button
          type="button"
          onClick={toggleBookmark}
          disabled={loading === "bookmark"}
          aria-label="收藏"
          aria-pressed={bookmarked}
          className={`${actionBtn} ${bookmarked ? "text-[var(--primary)]" : ""}`}
        >
          <IconBookmark filled={bookmarked} />
          <span>收藏</span>
        </button>
      )}

      <button
        type="button"
        onClick={shareIdea}
        aria-label="分享"
        className={`${actionBtn} ml-auto`}
      >
        <IconShare />
        <span>分享</span>
      </button>

      {user && (
        <button
          type="button"
          onClick={() => setReportOpen(true)}
          aria-label="举报这个想法"
          className={actionBtn}
        >
          <span>举报</span>
        </button>
      )}
      </div>

      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="idea"
        targetId={ideaId}
      />
    </div>
  );
}
