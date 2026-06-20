"use client";

import Link from "next/link";
import { User } from "@/lib/types";

export default function UserCard({ user }: { user: User }) {
  return (
    <Link
      href={`/users/${user.id}`}
      className="flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--bg-subtle)] transition-colors"
    >
      {user.avatar_url ? (
        <img
          src={user.avatar_url}
          alt=""
          className="w-10 h-10 rounded-full object-cover shrink-0"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center text-sm font-medium shrink-0">
          {user.name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <div className="text-sm font-medium text-[var(--title)] truncate">{user.name}</div>
        <div className="text-xs text-[var(--text-muted)]">
          {user.follower_count} 关注者 · {user.following_count} 关注中
        </div>
      </div>
    </Link>
  );
}
