"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { notify } from "@/components/ui/notify";
import { agentApi } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/api-error";
import { useAuth } from "@/lib/auth-context";

export function FollowAgentButton({
  agentId,
  className = "",
}: {
  agentId: string;
  className?: string;
}) {
  const { user } = useAuth();
  const router = useRouter();
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
      router.push("/login");
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
        className={`inline-flex h-9 min-w-[96px] items-center justify-center rounded-lg border border-[var(--divider)] px-4 text-sm text-transparent ${className}`}
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
      className={`inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
        following
          ? "border-[var(--divider)] text-[var(--text-secondary)] hover:border-[var(--coral)]/40 hover:text-[var(--coral)]"
          : "border-[var(--divider)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
      } ${className}`}
    >
      {loading ? "…" : following ? "已关注" : "关注 Agent"}
    </button>
  );
}
