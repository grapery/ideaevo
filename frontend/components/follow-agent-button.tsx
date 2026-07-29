"use client";

import { useEffect, useState } from "react";
import { DeimosIcon } from "@/components/deimos-icon";
import { Button } from "@/components/ui/button";
import { notify } from "@/components/ui/notify";
import { agentApi } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/api-error";
import { useAuth } from "@/lib/auth-context";
import { useAuthModal } from "@/lib/auth-modal-context";
import { useI18n } from "@/lib/i18n/provider";

export function FollowAgentButton({
  agentId,
  allowFollow = true,
  initialFollowing,
  className = "",
}: {
  agentId: string;
  allowFollow?: boolean;
  initialFollowing?: boolean;
  className?: string;
}) {
  const { user } = useAuth();
  const { locale, t } = useI18n();
  const { openAuthModal } = useAuthModal();
  const [following, setFollowing] = useState(initialFollowing ?? false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(initialFollowing !== undefined);

  useEffect(() => {
    if (initialFollowing !== undefined) {
      return;
    }
    if (!user) {
      return;
    }
    agentApi
      .getFollowStatus(agentId)
      .then((res) => setFollowing(res.is_following))
      .catch(() => {})
      .finally(() => setReady(true));
  }, [user, agentId, initialFollowing]);
  const readyForRender = ready || !user || initialFollowing !== undefined;

  if (allowFollow === false) return null;

  async function toggle() {
    if (!user) {
      openAuthModal();
      return;
    }
    setLoading(true);
    try {
      if (following) {
        await agentApi.unfollow(agentId);
        setFollowing(false);
        notify.success(locale === "zh-CN" ? "已取消关注" : "Unfollowed");
      } else {
        await agentApi.follow(agentId);
        setFollowing(true);
        notify.success(locale === "zh-CN" ? "已关注 Agent" : "Following Agent");
      }
    } catch (err) {
      notify.error(getErrorMessage(err, locale === "zh-CN" ? "操作失败" : "Action failed"));
    } finally {
      setLoading(false);
    }
  }

  if (!readyForRender) {
    return (
      <span
        className={`btn-default min-w-[96px] text-transparent ${className}`}
        aria-hidden="true"
      >
        {t("idea.follow")}
      </span>
    );
  }

  return (
    <Button
      variant={following ? "danger" : "primary"}
      onClick={toggle}
      disabled={loading}
      className={className}
      icon={
        loading
          ? undefined
          : following
          ? <DeimosIcon name="check" className="h-3.5 w-3.5" />
          : <DeimosIcon name="users" className="h-3.5 w-3.5" />
      }
    >
      {loading ? "…" : following
        ? (locale === "zh-CN" ? "已关注" : "Following")
        : t("idea.follow")}
    </Button>
  );
}
