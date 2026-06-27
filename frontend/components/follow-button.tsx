"use client";

import { useState } from "react";
import { userApi } from "@/lib/api-client";
import { notify } from "@/components/ui/notify";
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
      notify.error(getErrorMessage(err, "操作失败"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={following ? "btn-danger" : "btn-primary"}
    >
      {following ? "已关注" : "关注"}
    </button>
  );
}
