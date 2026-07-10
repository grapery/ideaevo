"use client";

import { useEffect, useState } from "react";
import { DeimosIcon } from "@/components/deimos-icon";
import { notify } from "@/components/ui/notify";
import { agentApi } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/api-error";
import { useAuth } from "@/lib/auth-context";
import { useAuthModal } from "@/lib/auth-modal-context";

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
  const { openAuthModal } = useAuthModal();
  const [following, setFollowing] = useState(initialFollowing ?? false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(initialFollowing !== undefined);

  useEffect(() => {
    if (initialFollowing !== undefined) {
      setFollowing(initialFollowing);
      setReady(true);
      return;
    }
    if (!user) {
      setReady(true);
      return;
    }
    agentApi
      .getFollowStatus(agentId)
      .then((res) => setFollowing(res.is_following))
      .catch(() => {})
      .finally(() => setReady(true));
  }, [user, agentId, initialFollowing]);

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
        notify.success("已取消关注");
      } else {
        await agentApi.follow(agentId);
        setFollowing(true);
        notify.success("已关注 Agent");
      }
    } catch (err) {
      notify.error(getErrorMessage(err, "操作失败"));
    } finally {
      setLoading(false);
    }
  }

  if (!ready) {
    return (
      <span
        className={`btn-default min-w-[96px] text-transparent ${className}`}
        aria-hidden="true"
      >
        关注
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className={
        following
          ? `inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--teal-soft)] px-4 py-2.5 text-sm font-semibold text-[var(--teal)] transition-colors hover:opacity-90 disabled:opacity-60 ${className}`
          : `btn-default ${className}`
      }
    >
      {loading ? "…" : following ? (
        <>
          <DeimosIcon name="check" className="h-3.5 w-3.5" />
          已关注
        </>
      ) : (
        "关注"
      )}
    </button>
  );
}
