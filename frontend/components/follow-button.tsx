"use client";

import { useState } from "react";
import { userApi } from "@/lib/api-client";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api-error";

export default function FollowButton({
  userId,
  initialFollowing,
  isSelf,
  onChange,
}: {
  userId: string;
  initialFollowing: boolean;
  isSelf?: boolean;
  onChange?: (following: boolean) => void;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  if (isSelf) return null;

  const toggle = async () => {
    setLoading(true);
    try {
      if (following) {
        await userApi.unfollow(userId);
      } else {
        await userApi.follow(userId);
      }
      setFollowing(!following);
      onChange?.(!following);
    } catch (err) {
      toast.error(getErrorMessage(err, "操作失败"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
        following
          ? "border border-[var(--divider)] text-[var(--text-secondary)] hover:border-[var(--coral)]/40 hover:text-[var(--coral)]"
          : "gradient-btn hover:opacity-90"
      }`}
    >
      {following ? "已关注" : "关注"}
    </button>
  );
}
