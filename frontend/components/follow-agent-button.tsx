"use client";

import { useEffect, useState } from "react";
import { notify } from "@/components/ui/notify";
import { agentApi } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/api-error";
import { useAuth } from "@/lib/auth-context";
import { useAuthModal } from "@/lib/auth-modal-context";

export function FollowAgentButton({
  agentId,
  allowFollow = true,
  className = "",
}: {
  agentId: string;
  allowFollow?: boolean;
  className?: string;
}) {
  const { user } = useAuth();
  const { openAuthModal } = useAuthModal();

  // 权限校验：agent 关闭了关注 → 隐藏按钮
  if (allowFollow === false) return null;
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user) {
      setReady(true);
      return;
    }
    agentApi
      .getFollowStatus(agentId)
      .then((res) => setFollowing(res.is_following))
      .catch(() => {})
      .finally(() => setReady(true));
  }, [user, agentId]);

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
        关注 Agent
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className={`${following ? "btn-danger" : "btn-default"} ${className}`}
    >
      {loading ? "…" : following ? "已关注" : "关注 Agent"}
    </button>
  );
}
