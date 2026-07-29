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
import { DeimosIcon } from "@/components/deimos-icon";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { useI18n } from "@/lib/i18n/provider";

export default function UserPageClient({
  profile,
  initialFollowing,
}: {
  profile: UserProfile;
  initialFollowing: boolean;
}) {
  const { t } = useI18n();
  const [followingState, setFollowingState] = useState(initialFollowing);
  const [reportOpen, setReportOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [blockedBy, setBlockedBy] = useState(false);
  const { user: currentUser } = useAuth();

  // 看自己 → 不显示关注按钮（与 own profile 一致）。
  const isSelf = currentUser?.id === profile.user.id;

  // 单点状态同时返回双向屏蔽关系，用于立即关闭关注等互动入口。
  useEffect(() => {
    if (!currentUser || isSelf) return;
    modApi
      .getBlockStatus(profile.user.id)
      .then((res) => {
        setBlocked(res.blocked);
        setBlockedBy(res.blocked_by);
      })
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
                {!blocked && !blockedBy && (
                  <FollowButton
                    userId={profile.user.id}
                    initialFollowing={followingState}
                    onChange={setFollowingState}
                    iconOnly
                  />
                )}
                <BlockButton
                  key={blocked ? "blocked" : "unblocked"}
                  userId={profile.user.id}
                  initialBlocked={blocked}
                  onChange={setBlocked}
                  iconOnly
                />
                <IconActionButton
                  onClick={() => setReportOpen(true)}
                  label={t("idea.report")}
                  icon={<DeimosIcon name="evidence" className="h-[18px] w-[18px]" />}
                />
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
