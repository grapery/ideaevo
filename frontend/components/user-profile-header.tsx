"use client";

import Link from "next/link";
import { User } from "@/lib/types";

interface UserProfileHeaderProps {
  user: User;
  stats?: {
    follower_count?: number;
    following_count?: number;
    idea_count?: number;
    session_count?: number;
  };
  isOwn?: boolean;
  actions?: React.ReactNode;
}

function Avatar({ user, size = "lg" }: { user: User; size?: "sm" | "lg" }) {
  const dim = size === "lg" ? "h-24 w-24 text-3xl" : "h-10 w-10 text-sm";
  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt=""
        className={`${dim} rounded-2xl object-cover shrink-0 border-4 border-white shadow-sm`}
      />
    );
  }
  return (
    <div
      className={`${dim} shrink-0 flex items-center justify-center rounded-2xl bg-[var(--primary-soft)] font-semibold text-[var(--primary)] border-4 border-white shadow-sm`}
    >
      {user.name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function UserProfileHeader({
  user,
  stats,
  isOwn,
  actions,
}: UserProfileHeaderProps) {
  const cover = user.background_url;
  const followers = stats?.follower_count ?? user.follower_count;
  const following = stats?.following_count ?? user.following_count;

  return (
    <div className="mb-8">
      <div className="relative h-36 sm:h-44 rounded-[28px] overflow-hidden bg-[var(--primary-soft)]">
        {cover ? (
          <img src={cover} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[var(--primary-soft)] via-[var(--bg-subtle)] to-[var(--teal)]/20" />
        )}
      </div>
      <div className="relative px-4 sm:px-6 -mt-12 flex flex-col sm:flex-row sm:items-end gap-4">
        <Avatar user={user} />
        <div className="flex-1 min-w-0 pb-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="heading-serif text-2xl font-medium text-[var(--title)]">
              {user.name}
            </h1>
            {isOwn && (
              <Link
                href="/user/settings"
                className="rounded-full border border-[var(--divider)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
              >
                编辑资料
              </Link>
            )}
          </div>
          {user.email && (
            <p className="text-sm text-[var(--text-muted)] mt-0.5">{user.email}</p>
          )}
          {user.bio && (
            <p className="text-sm text-[var(--text-secondary)] mt-2 max-w-xl">{user.bio}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-5 text-sm text-[var(--text-secondary)]">
            <span>
              <strong className="text-[var(--title)]">{followers}</strong> 粉丝
            </span>
            <span>
              <strong className="text-[var(--title)]">{following}</strong> 关注
            </span>
            {stats?.idea_count != null && (
              <span>
                <strong className="text-[var(--title)]">{stats.idea_count}</strong> 想法
              </span>
            )}
            {stats?.session_count != null && (
              <span>
                <strong className="text-[var(--title)]">{stats.session_count}</strong> 对话
              </span>
            )}
          </div>
        </div>
        {actions && <div className="shrink-0 pb-1">{actions}</div>}
      </div>
    </div>
  );
}
