"use client";

import { useEffect, useState } from "react";
import { DeimosIcon } from "@/components/deimos-icon";
import { Button } from "@/components/ui/button";
import { IconActionButton } from "@/components/ui/icon-action-button";
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
  iconOnly = false,
}: {
  agentId: string;
  allowFollow?: boolean;
  initialFollowing?: boolean;
  className?: string;
  iconOnly?: boolean;
}) {
  const { user } = useAuth();
  const { t } = useI18n();
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
    // 乐观更新:立即翻转 UI,失败时回滚。
    const prev = following;
    setFollowing(!following);
    try {
      if (prev) {
        await agentApi.unfollow(agentId);
        notify.success(t("idea.unfollowedToast"));
      } else {
        await agentApi.follow(agentId);
        notify.success(t("idea.followedAgentToast"));
      }
    } catch (err) {
      setFollowing(prev);
      notify.error(getErrorMessage(err, t("common.operationFailed")));
    } finally {
      setLoading(false);
    }
  }

  if (!readyForRender) {
    if (iconOnly) {
      return (
        <span
          className={`inline-flex h-11 w-11 rounded-full border border-[var(--rule)] bg-white opacity-50 ${className}`}
          aria-hidden="true"
        />
      );
    }
    return (
      <span
        className={`btn-default min-w-[96px] text-transparent ${className}`}
        aria-hidden="true"
      >
        {t("idea.follow")}
      </span>
    );
  }

  if (iconOnly) {
    const label = loading
      ? t("common.loading")
      : following
        ? t("idea.unfollowAgent")
        : t("idea.followAgent");

    return (
      <IconActionButton
        onClick={toggle}
        disabled={loading}
        label={label}
        tone={following ? "active" : "default"}
        className={className}
        icon={
          <DeimosIcon
            name={following ? "check" : "users"}
            className="h-[18px] w-[18px]"
          />
        }
      />
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
      {loading
        ? "…"
        : following
          ? t("idea.followingAgent")
          : t("idea.followAgent")}
    </Button>
  );
}
