"use client";

import { useState } from "react";
import { UserProfile } from "@/lib/types";
import FollowButton from "@/components/follow-button";
import UserProfileHeader from "@/components/user-profile-header";
import { UserProfileBody } from "@/components/user-profile-body";
import { useAuth } from "@/lib/auth-context";

export default function UserPageClient({
  profile,
  initialFollowing,
}: {
  profile: UserProfile;
  initialFollowing: boolean;
}) {
  const [followingState, setFollowingState] = useState(initialFollowing);
  const { user: currentUser } = useAuth();

  // 看自己 → 不显示关注按钮（与 own profile 一致）。
  const isSelf = currentUser?.id === profile.user.id;

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      <div className="mx-auto page-container py-6">
        <UserProfileHeader
          user={profile.user}
          stats={{
            follower_count: profile.follower_count,
            following_count: profile.following_count,
            idea_count: profile.idea_count,
          }}
          actions={
            !isSelf ? (
              <FollowButton
                userId={profile.user.id}
                initialFollowing={followingState}
                onChange={setFollowingState}
              />
            ) : undefined
          }
        />
      </div>
      <UserProfileBody
        userId={profile.user.id}
        isOwn={false}
        stats={{
          idea_count: profile.idea_count,
          follower_count: profile.follower_count,
          following_count: profile.following_count,
        }}
      />
    </div>
  );
}
