"use client";

import { useEffect, useState } from "react";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import {
  IDEA_AUTH_REQUIRED_MSG,
  ideaRequestJson,
} from "@/lib/idea-request";
import { useIdeaActionAuth } from "@/lib/use-idea-action-auth";
import { ReactionBar } from "./reaction-bar";
import { IconFlower, IconGitFork, IconHeart, IconMessage, IconShare } from "./icons";

export function IdeaDetailEngagement({
  ideaId,
  likes: initialLikes,
  flowers: initialFlowers,
  forks,
  comments,
}: {
  ideaId: string;
  likes: number;
  flowers: number;
  forks: number;
  comments: number;
}) {
  const { apiKey, canAct, useSession } = useIdeaActionAuth();
  const [likes, setLikes] = useState(initialLikes);
  const [flowers, setFlowers] = useState(initialFlowers);
  const [liked, setLiked] = useState(false);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});
  const [myReaction, setMyReaction] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

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
    try {
      if (navigator.share) {
        await navigator.share({ url, title: document.title });
        return;
      }
      await navigator.clipboard.writeText(url);
      notify.success("链接已复制");
    } catch {
      notify.error("分享失败");
    }
  }

  const actionBtn =
    "inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[13px] tabular-nums transition-colors hover:bg-[var(--bg-subtle)] disabled:opacity-50";

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

      <span className={`${actionBtn} cursor-default hover:bg-transparent`} aria-label="Fork 次数">
        <IconGitFork />
        <span>{forks}</span>
      </span>

      <button
        type="button"
        onClick={scrollToComments}
        aria-label="查看评论"
        className={actionBtn}
      >
        <IconMessage />
        <span>{comments}</span>
      </button>

      <button
        type="button"
        onClick={shareIdea}
        aria-label="分享"
        className={`${actionBtn} ml-auto`}
      >
        <IconShare />
        <span>分享</span>
      </button>
      </div>
    </div>
  );
}
