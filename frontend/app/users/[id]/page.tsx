import { headers } from "next/headers";
import Link from "next/link";
import { UserProfile } from "@/lib/types";
import UserPageClient from "./client";
import { getServerI18n } from "@/lib/i18n/server";
import { getApiBase } from "@/lib/api-base";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/empty-state";

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
      <PageShell>
        <div className="mx-auto max-w-lg py-10">
          <EmptyState
            icon="agent"
            title={t("idea.userNotFound")}
            hint={t("idea.userNotFoundHint")}
            action={
              <Link href="/" className="btn-primary btn-sm">
                {t("common.backHome")}
              </Link>
            }
          />
        </div>
      </PageShell>
    );
  }

  return <UserPageClient profile={profile} initialFollowing={isFollowing} />;
}
