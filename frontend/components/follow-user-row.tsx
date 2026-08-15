"use client";

import Link from "next/link";
import { User } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import FollowButton from "@/components/follow-button";
import { useI18n } from "@/lib/i18n/provider";

/**
 * FollowUserRow —— 粉丝/关注列表行：头像 + 名称 + 计数，右侧可关注/取消。
 * 整行可点进用户主页；关注按钮独立，避免误跳转。
 */
export function FollowUserRow({
  user,
  initialFollowing,
  onFollowingChange,
}: {
  user: User;
  initialFollowing: boolean;
  onFollowingChange?: (following: boolean) => void;
}) {
  const { user: me } = useAuth();
  const { t } = useI18n();
  const isSelf = me?.id === user.id;

  return (
    <div className="flex items-center gap-3 border-b border-[var(--divider)] px-4 py-3 last:border-b-0">
      <Link
        href={`/users/${user.id}`}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt=""
            className="h-12 w-12 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-sm font-medium text-[var(--primary)]">
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold text-[var(--title)]">
            {user.name}
          </div>
          <div className="mt-0.5 text-[13px] text-[var(--text-muted)]">
            {user.follower_count} {t("profile.followers")}
            {" · "}
            {user.following_count} {t("profile.following")}
          </div>
        </div>
      </Link>
      {me && !isSelf && (
        <div className="shrink-0">
          <FollowButton
            userId={user.id}
            initialFollowing={initialFollowing}
            onChange={onFollowingChange}
          />
        </div>
      )}
    </div>
  );
}
