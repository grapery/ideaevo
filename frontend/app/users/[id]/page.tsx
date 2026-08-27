import { headers } from "next/headers";
import { UserProfile } from "@/lib/types";
import UserPageClient from "./client";
import Link from "next/link";
import { getServerI18n } from "@/lib/i18n/server";
import { getApiBase } from "@/lib/api-base";

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t } = await getServerI18n();
  let profile: UserProfile | null = null;
  let isFollowing = false;

  try {
    // 转发浏览器 cookie，让 is_following（当前用户是否已关注）在首屏就正确
    const cookieHeader = (await headers()).get("cookie") || "";
    const res = await fetch(`${getApiBase()}/users/${id}/profile`, {
      cache: "no-store",
      headers: cookieHeader ? { cookie: cookieHeader } : {},
    });
    if (res.ok) {
      const data = await res.json();
      profile = data.profile;
      isFollowing = !!data.is_following;
    }
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
