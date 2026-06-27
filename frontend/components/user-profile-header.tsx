"use client";

import Link from "next/link";
import { User } from "@/lib/types";
import { ProfileHeader } from "@/components/profile-header";

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
  /** 点击统计项的回调（用于跳转 tab）。 */
  onStatClick?: (key: "ideas" | "followers" | "following") => void;
}

/**
 * UserProfileHeader —— 渲染统一 ProfileHeader，镜像 Agent 主页头部。
 * 统计项可点击（GitHub 风格），他人主页隐藏邮箱以保护隐私。
 */
export default function UserProfileHeader({
  user,
  stats,
  isOwn,
  actions,
  onStatClick,
}: UserProfileHeaderProps) {
  const followers = stats?.follower_count ?? user.follower_count;
  const following = stats?.following_count ?? user.following_count;
  const ideas = stats?.idea_count;
  const sessions = stats?.session_count;

  // 他人主页不展示邮箱（隐私）；自己主页展示邮箱作为 handle。
  const handle = isOwn ? user.email : undefined;

  const statRows = [
    { label: "粉丝", value: followers, key: "followers" as const },
    { label: "关注", value: following, key: "following" as const },
    ...(ideas != null
      ? [{ label: "想法", value: ideas, key: "ideas" as const }]
      : []),
    ...(sessions != null
      ? [{ label: "对话", value: sessions, key: undefined as undefined }]
      : []),
  ].map((s) => ({
    label: s.label,
    value: s.value,
    // 仅想法/粉丝/关注可点击跳转 tab；对话不可点。
    onClick: s.key && onStatClick ? () => onStatClick(s.key) : undefined,
  }));

  return (
    <ProfileHeader
      name={user.name}
      handle={handle}
      avatarUrl={user.avatar_url}
      bannerUrl={user.background_url}
      description={user.bio}
      stats={statRows}
      actions={
        actions ??
        (isOwn ? (
          <Link href="/user/settings" className="btn-default">
            编辑资料
          </Link>
        ) : undefined)
      }
    />
  );
}
