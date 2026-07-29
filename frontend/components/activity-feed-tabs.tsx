"use client";

import { useCallback, useEffect, useState } from "react";
import { getApiBase } from "@/lib/api-base";
import { useAuth } from "@/lib/auth-context";
import { ActivityList, ActivityLog } from "@/components/activity-list";
import { AppLink as Link } from "@/components/app-link";
import { useI18n } from "@/lib/i18n/provider";

type Tab = "global" | "following";

interface FeedResponse {
  activities?: ActivityLog[];
}

export function ActivityFeedTabs({
  initialGlobal,
}: {
  initialGlobal: ActivityLog[];
}) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("global");
  const [global, setGlobal] = useState<ActivityLog[]>(initialGlobal);
  const [following, setFollowing] = useState<ActivityLog[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const loadFollowing = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`${getApiBase()}/activity/following?limit=30`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      const data: FeedResponse = await res.json();
      setFollowing(data.activities ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // 切到关注 tab 时按需拉取（登录用户才拉）。
  useEffect(() => {
    if (tab === "following" && user && following === null) {
      loadFollowing();
    }
  }, [tab, user, following, loadFollowing]);

  return (
    <div className="surface-card">
      {/* tab 切换 */}
      <div className="flex border-b border-[var(--divider)]">
        <TabButton active={tab === "global"} onClick={() => setTab("global")}>
          {t("activity.allFeed")}
        </TabButton>
        <TabButton
          active={tab === "following"}
          onClick={() => user && setTab("following")}
          disabled={!user}
        >
          {t("activity.followFeed")}
        </TabButton>
      </div>

      {tab === "global" && <ActivityList activities={global} />}

      {tab === "following" &&
        (user ? (
          loading ? (
            <div className="p-8 text-center text-[var(--text-muted)]">
              {t("common.loading")}
            </div>
          ) : error ? (
            <div className="p-8 text-center text-[var(--text-muted)]">
              {t("activity.feedLoadFailed")}
            </div>
          ) : (
            <ActivityList activities={following ?? []} />
          )
        ) : (
          <div className="p-8 text-center text-[var(--text-muted)]">
            <p className="mb-3">
              <Link
                href="/login"
                className="text-[var(--primary)] hover:underline"
              >
                {t("auth.loginShort")}
              </Link>{" "}
              {t("activity.loginToView")}
            </p>
          </div>
        ))}
    </div>
  );
}

function TabButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 px-5 py-4 text-sm font-semibold transition-colors ${
        active
          ? "text-[var(--title)] border-b-2 border-[var(--primary)]"
          : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    >
      {children}
    </button>
  );
}
