"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import { ideaRequestJson } from "@/lib/idea-request";
import { useIdeaActionAuth } from "@/lib/use-idea-action-auth";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import { ReactionBar } from "./reaction-bar";
import { ReportDialog } from "./report-dialog";
import { IconBookmark, IconShare } from "./icons";
import { DeimosIcon } from "./deimos-icon";
import { CountButton } from "./ui/count-button";
import { useI18n } from "@/lib/i18n/provider";
import { useIdeaDetailTab } from "@/components/idea-detail-tabs";
import type { Idea } from "@/lib/types";

export function IdeaDetailEngagement({
  ideaId,
  likes: initialLikes,
  wishes: initialWishes,
  flowers: initialFlowers,
  forks,
  comments,
  status,
  forkListOpen = false,
  onForkListToggle,
}: {
  ideaId: string;
  likes: number;
  wishes?: number;
  flowers?: number;
  forks: number;
  comments: number;
  status?: Idea["status"];
  forkListOpen?: boolean;
  onForkListToggle?: () => void;
}) {
  const { apiKey, canAct, useSession } = useIdeaActionAuth();
  const { user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const detailTab = useIdeaDetailTab();
  // 非 active 状态（已实现/已归档/已埋没）的 idea 为只读：禁用写入类操作，
  // 但保留收藏、分享、举报等无害操作。
  const inactive = status !== undefined && status !== "active";
  const [likes, setLikes] = useState(initialLikes);
  const [wishes, setWishes] = useState(initialWishes ?? 0);
  const [flowers, setFlowers] = useState(initialFlowers ?? 0);
  const [liked, setLiked] = useState(false);
  const [wished, setWished] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});
  const [myReaction, setMyReaction] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [flowerAvailable, setFlowerAvailable] = useState<number | null>(null);

  useEffect(() => {
    setLikes(initialLikes);
    setWishes(initialWishes ?? 0);
    setFlowers(initialFlowers ?? 0);
  }, [initialLikes, initialWishes, initialFlowers]);

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
    ideaRequestJson<{ wished: boolean }>(`/ideas/${ideaId}/wish`, {
      apiKey: useSession ? undefined : apiKey,
      useSession,
    })
      .then((res) => setWished(res.wished))
      .catch(() => {});
  }, [ideaId, canAct, apiKey, useSession]);

  // 今日送花余额（用户 JWT 或 Agent API Key → 所属用户配额）
  useEffect(() => {
    if (!canAct) {
      setFlowerAvailable(null);
      return;
    }
    ideaRequestJson<{ available: number }>("/user/flowers", {
      apiKey: useSession ? undefined : apiKey,
      useSession,
    })
      .then((res) => setFlowerAvailable(res.available))
      .catch(() => setFlowerAvailable(null));
  }, [canAct, apiKey, useSession]);

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
        notify.success(t("idea.bookmarked"));
      }
    } catch (err) {
      notify.error(getErrorMessage(err, t("idea.bookmarkFailed")));
    } finally {
      setLoading(null);
    }
  }

  async function toggleLike() {
    if (!canAct) {
      notify.error(t("idea.authRequired"));
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
        notify.success(t("idea.liked"));
      }
    } catch (err) {
      notify.error(getErrorMessage(err, t("idea.likeFailed")));
    } finally {
      setLoading(null);
    }
  }

  async function toggleWish() {
    if (!canAct) {
      notify.error(t("idea.authRequired"));
      return;
    }
    setLoading("wish");
    try {
      if (wished) {
        await ideaRequestJson(`/ideas/${ideaId}/wish`, {
          method: "DELETE",
          apiKey: useSession ? undefined : apiKey,
          useSession,
        });
        setWished(false);
        setWishes((n) => Math.max(0, n - 1));
      } else {
        await ideaRequestJson(`/ideas/${ideaId}/wish`, {
          method: "POST",
          apiKey: useSession ? undefined : apiKey,
          useSession,
        });
        setWished(true);
        setWishes((n) => n + 1);
        notify.success(t("idea.wished"));
      }
      router.refresh();
    } catch (err) {
      notify.error(getErrorMessage(err, t("idea.wishFailed")));
    } finally {
      setLoading(null);
    }
  }

  async function sendFlower() {
    if (!canAct) {
      notify.error(t("idea.authRequired"));
      return;
    }
    if (flowerAvailable === 0) {
      notify.error(t("idea.flowerBudgetExhausted"));
      return;
    }
    setLoading("flower");
    try {
      const res = await ideaRequestJson<{ available: number }>(`/ideas/${ideaId}/flowers`, {
        method: "POST",
        body: JSON.stringify({}),
        apiKey: useSession ? undefined : apiKey,
        useSession,
      });
      setFlowers((n) => n + 1);
      setFlowerAvailable(res.available);
      notify.success(t("idea.flowerSent"));
      router.refresh();
    } catch (err) {
      notify.error(getErrorMessage(err, t("idea.flowerFailed")));
    } finally {
      setLoading(null);
    }
  }

  function scrollToComments() {
    if (detailTab) {
      detailTab.setTab("comments");
      requestAnimationFrame(() => {
        document.getElementById("comments")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return;
    }
    router.push(`/ideas/${ideaId}?tab=comments`);
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
        notify.success(t("idea.linkCopied"));
      }
    } catch {
      // 用户取消分享 (AbortError) 也会进这里，不计为分享成功
      notify.error(t("idea.shareFailed"));
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
      {!inactive && (
        <ReactionBar
          ideaId={ideaId}
          initialCounts={reactionCounts}
          initialMine={myReaction}
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <CountButton
          variant="soft"
          icon={<DeimosIcon name="heart" className="h-3.5 w-3.5" />}
          count={likes}
          active={liked}
          tone="coral"
          onClick={toggleLike}
          disabled={inactive || loading === "like"}
          ariaLabel={t("idea.statLikes")}
        />

        <CountButton
          variant="soft"
          icon={<DeimosIcon name="wish" className="h-3.5 w-3.5" />}
          count={wishes}
          active={wished}
          tone="coral"
          onClick={toggleWish}
          disabled={inactive || loading === "wish"}
          ariaLabel={t("idea.statWishes")}
        />

        <CountButton
          variant="soft"
          icon={<DeimosIcon name="flower" className="h-3.5 w-3.5" />}
          count={flowers}
          tone="link"
          onClick={sendFlower}
          disabled={inactive || loading === "flower" || flowerAvailable === 0}
          ariaLabel={t("idea.sendFlower")}
          title={
            flowerAvailable === null
              ? t("idea.sendFlower")
              : flowerAvailable > 0
                ? t("idea.flowerAvailable", { count: flowerAvailable })
                : t("idea.flowerBudgetExhausted")
          }
        />
        {canAct && flowerAvailable !== null && !inactive && (
          <span className="text-[11px] tabular-nums text-[var(--ink-faint)]">
            {flowerAvailable > 0
              ? t("idea.flowerAvailable", { count: flowerAvailable })
              : t("idea.flowerBudgetExhausted")}
          </span>
        )}

        <CountButton
          variant="soft"
          icon={<DeimosIcon name="fork" className="h-3.5 w-3.5" />}
          count={forks}
          active={forkListOpen}
          tone="primary"
          onClick={() => onForkListToggle?.()}
          disabled={!onForkListToggle}
          ariaLabel={t("idea.viewForkDerivatives")}
        />

        <CountButton
          variant="soft"
          icon={<DeimosIcon name="comment" className="h-3.5 w-3.5" />}
          count={comments}
          onClick={scrollToComments}
          ariaLabel={t("idea.viewComments")}
        />

        {user && (
          <CountButton
            variant="soft"
            icon={<IconBookmark filled={bookmarked} className="h-3.5 w-3.5" />}
            label={t("idea.bookmark")}
            active={bookmarked}
            tone="primary"
            onClick={toggleBookmark}
            disabled={loading === "bookmark"}
            ariaLabel={t("idea.bookmark")}
          />
        )}

        <CountButton
          variant="soft"
          icon={<IconShare className="h-3.5 w-3.5" />}
          label={t("idea.share")}
          onClick={shareIdea}
          ariaLabel={t("idea.share")}
          className="ml-auto"
        />

        {user && (
          <CountButton
            variant="soft"
            label={t("idea.report")}
            onClick={() => setReportOpen(true)}
            ariaLabel={t("idea.reportIdea")}
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
