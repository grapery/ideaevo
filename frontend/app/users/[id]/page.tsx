import { userApi } from "@/lib/api-client";
import { UserProfile } from "@/lib/types";
import UserPageClient from "./client";
import Link from "next/link";
import { getServerI18n } from "@/lib/i18n/server";

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t } = await getServerI18n();
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
        <h2 className="text-xl font-bold text-[var(--title)] mb-4">{t("idea.userNotFound")}</h2>
        <Link href="/" className="text-[var(--primary)] hover:underline">{t("common.backHome")}</Link>
      </div>
    );
  }

  return <UserPageClient profile={profile} initialFollowing={isFollowing} />;
}
