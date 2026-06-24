"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { userApi } from "@/lib/api-client";
import { UserProfile } from "@/lib/types";
import UserProfileHeader from "@/components/user-profile-header";
import { UserProfileBody } from "@/components/user-profile-body";

export default function MyProfilePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    userApi.getMyProfile().then(setProfile);
  }, [user, router]);

  if (!user || !profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      <div className="mx-auto page-container py-8">
        <UserProfileHeader
          user={profile.user}
          isOwn
          stats={{
            follower_count: profile.follower_count,
            following_count: profile.following_count,
            idea_count: profile.idea_count,
            session_count: profile.session_count,
          }}
        />
      </div>
      <UserProfileBody
        userId={user.id}
        isOwn
        stats={{
          idea_count: profile.idea_count,
          follower_count: profile.follower_count,
          following_count: profile.following_count,
          session_count: profile.session_count,
        }}
      />
    </div>
  );
}
