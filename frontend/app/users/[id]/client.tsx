"use client";

import { useEffect, useState } from "react";
import { UserProfile } from "@/lib/types";
import FollowButton from "@/components/follow-button";
import UserProfileHeader from "@/components/user-profile-header";
import { UserProfileBody } from "@/components/user-profile-body";
import { BlockButton } from "@/components/block-button";
import { ReportDialog } from "@/components/report-dialog";
import { useAuth } from "@/lib/auth-context";
import { modApi } from "@/lib/api-client";

export default function UserPageClient({
  profile,
  initialFollowing,
}: {
  profile: UserProfile;
  initialFollowing: boolean;
}) {
  const [followingState, setFollowingState] = useState(initialFollowing);
  const [reportOpen, setReportOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const { user: currentUser } = useAuth();

  // 看自己 → 不显示关注按钮（与 own profile 一致）。
  const isSelf = currentUser?.id === profile.user.id;

  // 登录用户预查是否已屏蔽该用户（后端无单点状态接口，用 listBlocks 判断）
  useEffect(() => {
    if (!currentUser || isSelf) return;
    modApi
      .listBlocks()
      .then((res) => setBlocked(res.users.some((u) => u.id === profile.user.id)))
      .catch(() => {});
  }, [currentUser, isSelf, profile.user.id]);

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      <div className="mx-auto page-container py-6">
        <UserProfileHeader
          user={profile.user}
          stats={{
            follower_count: profile.follower_count,
            following_count: profile.following_count,
            idea_count: profile.idea_count,
            agent_count: profile.agent_count,
          }}
          onStatClick={(key) =>
            window.dispatchEvent(new CustomEvent("profile-tab-change", { detail: key }))
          }
          actions={
            !isSelf && currentUser ? (
              <div className="flex flex-wrap items-center gap-2">
                <FollowButton
                  userId={profile.user.id}
                  initialFollowing={followingState}
                  onChange={setFollowingState}
                />
                <BlockButton userId={profile.user.id} initialBlocked={blocked} />
                <button
                  type="button"
                  onClick={() => setReportOpen(true)}
                  className="btn-default"
                >
                  举报
                </button>
              </div>
            ) : undefined
          }
        />
      </div>
      <UserProfileBody
        userId={profile.user.id}
        user={profile.user}
        isOwn={false}
        stats={{
          idea_count: profile.idea_count,
          agent_count: profile.agent_count,
          follower_count: profile.follower_count,
          following_count: profile.following_count,
        }}
      />
      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="user"
        targetId={profile.user.id}
        targetName={profile.user.name}
      />
    </div>
  );
}
