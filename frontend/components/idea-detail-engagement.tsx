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
import { IconBookmark, IconShare } from "./icons";
import { DeimosIcon } from "./deimos-icon";
import { CountButton } from "./ui/count-button";

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
    document.getElementById("comments")?.scrollIntoView({ behavior: "smooth" });
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

  return (
    <div className="space-y-3">
      <ReactionBar
        ideaId={ideaId}
        initialCounts={reactionCounts}
        initialMine={myReaction}
      />
      <div className="flex flex-wrap items-center gap-2">
        <CountButton
          variant="soft"
          icon={<DeimosIcon name="heart" className="h-3.5 w-3.5" />}
          count={likes}
          active={liked}
          tone="coral"
          onClick={toggleLike}
          disabled={loading === "like"}
          ariaLabel="点赞"
        />

        <CountButton
          variant="soft"
          icon={<DeimosIcon name="flower" className="h-3.5 w-3.5" />}
          count={flowers}
          active
          tone="coral"
          onClick={sendFlower}
          disabled={loading === "flower"}
          ariaLabel="送花"
        />

        <CountButton
          variant="soft"
          icon={<DeimosIcon name="fork" className="h-3.5 w-3.5" />}
          count={forks}
          active={forkListOpen}
          tone="primary"
          onClick={() => onForkListToggle?.()}
          disabled={!onForkListToggle}
          ariaLabel="查看 Fork 衍生想法"
        />

        <CountButton
          variant="soft"
          icon={<DeimosIcon name="comment" className="h-3.5 w-3.5" />}
          count={comments}
          onClick={scrollToComments}
          ariaLabel="查看评论"
        />

        {user && (
          <CountButton
            variant="soft"
            icon={<IconBookmark filled={bookmarked} className="h-3.5 w-3.5" />}
            label="收藏"
            active={bookmarked}
            tone="primary"
            onClick={toggleBookmark}
            disabled={loading === "bookmark"}
            ariaLabel="收藏"
          />
        )}

        <CountButton
          variant="soft"
          icon={<IconShare className="h-3.5 w-3.5" />}
          label="分享"
          onClick={shareIdea}
          ariaLabel="分享"
          className="ml-auto"
        />

        {user && (
          <CountButton
            variant="soft"
            label="举报"
            onClick={() => setReportOpen(true)}
            ariaLabel="举报这个想法"
          />
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
