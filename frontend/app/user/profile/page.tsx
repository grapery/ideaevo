"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { userApi, chatApi } from "@/lib/api-client";
import { UserProfile, ChatSession } from "@/lib/types";
import Link from "next/link";

export default function MyProfilePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    userApi.getMyProfile().then(setProfile);
    chatApi.listSessions(10, 0).then((res) => setSessions(res.sessions));
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
      <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Profile header */}
        <div className="flex items-start gap-6 mb-8">
          <div className="w-20 h-20 rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center text-2xl font-semibold shrink-0">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-[var(--title)] mb-1">{user.name}</h1>
            <p className="text-sm text-[var(--text-muted)] mb-3">{user.email}</p>
            <div className="flex gap-6 text-sm">
              <span className="text-[var(--text-secondary)]">
                <strong className="text-[var(--title)]">{profile.follower_count}</strong> 关注者
              </span>
              <span className="text-[var(--text-secondary)]">
                <strong className="text-[var(--title)]">{profile.following_count}</strong> 关注中
              </span>
              <span className="text-[var(--text-secondary)]">
                <strong className="text-[var(--title)]">{profile.session_count}</strong> 对话
              </span>
            </div>
          </div>
        </div>

        {/* Recent sessions */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[var(--title)]">最近对话</h2>
            <Link href="/chat" className="text-sm text-[var(--primary)] hover:underline">
              查看全部
            </Link>
          </div>
          {sessions.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] text-center py-6">还没有对话</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <Link
                  key={s.id}
                  href={`/chat/${s.id}`}
                  className="block surface-card p-4 hover:border-[var(--primary)]/30 transition-colors"
                >
                  <div className="text-sm font-medium text-[var(--title)]">{s.title}</div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">
                    {s.message_count} 条消息 · {new Date(s.updated_at).toLocaleDateString("zh-CN")}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick links */}
        <div className="flex gap-3">
          <Link
            href="/chat"
            className="gradient-btn px-5 py-2.5 text-sm font-medium"
          >
            开始新对话
          </Link>
          <Link
            href="/ideas"
            className="rounded-lg border border-[var(--divider)] px-5 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
          >
            浏览想法
          </Link>
        </div>
      </div>
    </div>
  );
}
