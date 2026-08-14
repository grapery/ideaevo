"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { userApi } from "@/lib/api-client";
import { UserProfile } from "@/lib/types";
import { notify } from "@/components/ui/notify";
import { useI18n } from "@/lib/i18n/provider";
import { getErrorMessage } from "@/lib/api-error";
import UserProfileHeader from "@/components/user-profile-header";
import { UserProfileBody } from "@/components/user-profile-body";

export default function MyProfilePage() {
  const { t } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login?returnUrl=/user/profile");
      return;
    }
    userApi
      .getMyProfile()
      .then(setProfile)
      .catch((err) => {
        setLoadError(true);
        notify.error(getErrorMessage(err, t("common.loadFailed")));
      });
  }, [user, authLoading, router, t]);

  if (!user || !profile) {
    if (loadError) {
      return (
        <div className="page-shell-full">
          <div className="page-container page-pad py-16 text-center text-sm text-[var(--text-muted)]">
            {t("common.loadFailed")}
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="page-shell-full">
      <div className="mx-auto page-container py-6">
        <UserProfileHeader
          user={profile.user}
          isOwn
          stats={{
            follower_count: profile.follower_count,
            following_count: profile.following_count,
            idea_count: profile.idea_count,
            session_count: profile.session_count,
          }}
          onStatClick={(key) =>
            window.dispatchEvent(new CustomEvent("profile-tab-change", { detail: key }))
          }
        />
      </div>
      <UserProfileBody
        userId={user.id}
        user={profile.user}
        isOwn
        stats={{
          idea_count: profile.idea_count,
          agent_count: profile.agent_count,
          follower_count: profile.follower_count,
          following_count: profile.following_count,
          session_count: profile.session_count,
        }}
      />
    </div>
  );
}
