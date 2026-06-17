"use client";

import { useState, useEffect } from "react";
import { UserProfile, User } from "@/lib/types";
import FollowButton from "@/components/follow-button";
import { userApi } from "@/lib/api-client";
import UserCard from "@/components/user-card";
import { IconSearch, IconLeaf } from "@/components/icons";

type TabKey = "following" | "followers" | "mutuals";
type SortKey = "recent" | "earliest";

export default function UserPageClient({
  profile,
  initialFollowing,
}: {
  profile: UserProfile;
  initialFollowing: boolean;
}) {
  const [tab, setTab] = useState<TabKey>("followers");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [followingList, setFollowingList] = useState<User[]>([]);
  const [followersList, setFollowersList] = useState<User[]>([]);
  const [loaded, setLoaded] = useState<Record<TabKey, boolean>>({
    following: false,
    followers: false,
    mutuals: false,
  });
  const [followingState, setFollowingState] = useState(initialFollowing);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");

  async function loadList(type: TabKey) {
    setTab(type);
    if (type === "followers" && !loaded.followers) {
      try {
        const res = await userApi.getFollowers(profile.user.id);
        setFollowersList(res.users);
      } catch {}
      setLoaded((p) => ({ ...p, followers: true }));
    }
    if (type === "following" && !loaded.following) {
      try {
        const res = await userApi.getFollowing(profile.user.id);
        setFollowingList(res.users);
      } catch {}
      setLoaded((p) => ({ ...p, following: true }));
    }
    if (type === "mutuals" && !loaded.mutuals) {
      try {
        const [f1, f2] = await Promise.all([
          userApi.getFollowers(profile.user.id),
          userApi.getFollowing(profile.user.id),
        ]);
        const followingIds = new Set(f2.users.map((u) => u.id));
        setFollowersList((_) => f1.users);
        setFollowingList((_) => f2.users);
        const mutuals = f1.users.filter((u) => followingIds.has(u.id));
        setFollowersList((_) => f1.users);
        setMutualsList(mutuals);
      } catch {}
      setLoaded((p) => ({ ...p, mutuals: true }));
    }
  }

  const [mutualsList, setMutualsList] = useState<User[]>([]);

  const current = tab === "followers" ? followersList : tab === "following" ? followingList : mutualsList;

  const filtered = current
    .filter((u) =>
      search.trim() ? u.name.toLowerCase().includes(search.toLowerCase()) : true
    )
    .sort((a, b) => {
      if (sort === "earliest") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const tabsConfig: { key: TabKey; label: string; count: number }[] = [
    { key: "following", label: "关注的人", count: profile.following_count },
    { key: "followers", label: "粉丝", count: profile.follower_count },
    { key: "mutuals", label: "互相关注", count: loaded.mutuals ? mutualsList.length : 0 },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-start gap-5 mb-6 flex-wrap">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-3xl font-semibold text-[var(--primary)]">
            {profile.user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-[24px] font-semibold text-[var(--title)]">
              {profile.user.name}
            </h1>
            <p className="text-sm text-[var(--text-muted)]">
              加入于 {mounted ? new Date(profile.user.created_at).toLocaleDateString("zh-CN") : profile.user.created_at.slice(0, 10)}
            </p>
            <div className="mt-3 flex gap-5 text-sm">
              {tabsConfig.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => loadList(t.key)}
                  className={`text-[var(--text-secondary)] hover:text-[var(--primary)] ${
                    tab === t.key ? "font-semibold text-[var(--primary)]" : ""
                  }`}
                >
                  <span className="font-semibold text-[var(--title)]">{t.count}</span> {t.label}
                </button>
              ))}
            </div>
          </div>
          <FollowButton
            userId={profile.user.id}
            initialFollowing={followingState}
            onChange={setFollowingState}
          />
        </div>

        {/* Tabs */}
        <div className="border-b border-[var(--divider)] mb-4 flex gap-6">
          {tabsConfig.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => loadList(t.key)}
              className={`pb-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.key
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--title)]"
              }`}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <label htmlFor="followers-search" className="sr-only">搜索粉丝</label>
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
            <input
              id="followers-search"
              name="followers-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索粉丝…"
              className="w-full rounded-lg border border-[var(--divider)] bg-[var(--bg-subtle)] pl-9 pr-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:bg-white"
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[var(--text-muted)]">排序:</span>
            {(["recent", "earliest"] as SortKey[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSort(s)}
                className={`rounded-md px-3 py-1 ${
                  sort === s
                    ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"
                }`}
              >
                {s === "recent" ? "最近活跃" : "最早关注"}
              </button>
            ))}
          </div>
        </div>

        {/* User grid */}
        {!loaded[tab] ? (
          <div className="text-center py-12 text-[var(--text-muted)]">点击 Tab 加载列表…</div>
        ) : filtered.length === 0 ? (
          <div className="surface-card p-12 text-center text-[var(--text-muted)]">
            <IconLeaf className="h-10 w-10 mx-auto mb-3 text-[var(--text-muted)]" aria-hidden="true" />
            <p>{search ? "没有匹配的用户" : "暂无数据"}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((u) => (
              <div key={u.id} className="surface-card p-4">
                <UserCard user={u} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
