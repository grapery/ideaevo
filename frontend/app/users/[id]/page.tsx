import { userApi } from "@/lib/api-client";
import { UserProfile } from "@/lib/types";
import UserPageClient from "./client";

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let profile: UserProfile | null = null;
  let isFollowing = false;

  try {
    const res = await userApi.getProfile(id);
    profile = res.profile;
    isFollowing = res.is_following;
  } catch {
    // user not found
  }

  if (!profile) {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center">
        <h2 className="text-xl font-bold text-[var(--title)] mb-4">用户不存在</h2>
        <a href="/" className="text-[var(--primary)] hover:underline">返回首页</a>
      </div>
    );
  }

  return <UserPageClient profile={profile} initialFollowing={isFollowing} />;
}
