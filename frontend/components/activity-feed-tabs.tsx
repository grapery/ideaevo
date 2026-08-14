"use client";

import { useCallback, useEffect, useState } from "react";
import { getApiBase } from "@/lib/api-base";
import { useAuth } from "@/lib/auth-context";
import { useAuthModal } from "@/lib/auth-modal-context";
import { ActivityList, ActivityLog } from "@/components/activity-list";
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
  const { openAuthModal } = useAuthModal();
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("global");
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

  useEffect(() => {
    if (tab === "following" && user && following === null) {
      loadFollowing();
    }
  }, [tab, user, following, loadFollowing]);

  function selectTab(next: Tab) {
    if (next === "following" && !user) {
      openAuthModal();
      return;
    }
    setTab(next);
  }

  return (
    <div>
      {/* 位于 overflow-hidden 卡片内,sticky 不生效,故不加 sticky-tabbar */}
      <div className="mb-1 flex gap-1 border-b border-[var(--rule)]">
        <TabButton active={tab === "global"} onClick={() => selectTab("global")}>
          {t("activity.allFeed")}
        </TabButton>
        <TabButton active={tab === "following"} onClick={() => selectTab("following")}>
          {t("activity.followFeed")}
        </TabButton>
      </div>

      {tab === "global" && <ActivityList activities={initialGlobal} />}

      {tab === "following" &&
        (user ? (
          loading ? (
            <div className="px-5 py-12 text-center text-[14px] text-[var(--ink-faint)]">
              {t("common.loading")}
            </div>
          ) : error ? (
            <div className="px-5 py-12 text-center text-[14px] text-[var(--ink-faint)]">
              {t("activity.feedLoadFailed")}
            </div>
          ) : (
            <ActivityList activities={following ?? []} />
          )
        ) : (
          <div className="px-5 py-12 text-center text-[14px] text-[var(--ink-faint)]">
            <button
              type="button"
              onClick={() => openAuthModal()}
              className="font-medium text-[var(--primary)] hover:underline"
            >
              {t("auth.loginShort")}
            </button>{" "}
            {t("activity.loginToView")}
          </div>
        ))}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative px-4 py-3 text-[14px] font-semibold transition-colors ${
        active
          ? "text-[var(--ink)]"
          : "text-[var(--ink-faint)] hover:text-[var(--ink)]"
      }`}
    >
      {children}
      {active && (
        <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[var(--primary)]" />
      )}
    </button>
  );
}
