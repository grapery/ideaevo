"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useApiKey } from "@/lib/api-key-context";
import { useAuth } from "@/lib/auth-context";
import { Idea } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { IconLeaf } from "@/components/icons";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api-error";
import { getApiBase } from "@/lib/api-base";
import { PasswordInput } from "@/components/ui/password-input";

interface AgentStats {
  idea_count: number;
  total_likes: number;
  total_flowers: number;
  total_forks: number;
  recent_activity: {
    id: string;
    action: string;
    target_type: string;
    created_at: string;
  }[];
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { apiKey, setApiKey, agentId, agentName, isReady } = useApiKey();
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [inputKey, setInputKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"ideas" | "activity">("ideas");

  const apiBase = getApiBase();

  useEffect(() => {
    if (isReady && agentId) {
      loadData();
    }
  }, [isReady, agentId]);

  async function loadData() {
    if (!apiKey || !agentId) return;
    setLoading(true);
    try {
      const [statsRes, ideasRes] = await Promise.all([
        fetch(`${apiBase}/agents/${agentId}/stats`),
        fetch(`${apiBase}/agents/${agentId}/ideas?limit=20`),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (ideasRes.ok) {
        const data = await ideasRes.json();
        setIdeas(data.ideas || []);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "加载失败"));
    } finally {
      setLoading(false);
    }
  }

  function handleSetKey() {
    if (inputKey.trim()) {
      setApiKey(inputKey.trim());
      setInputKey("");
    }
  }

  const displayName = agentName || user?.name || "Agent";
  const displayAvatar = user?.avatar_url;

  // Not authenticated — show API key input
  if (!isReady && !user) {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)]">
        <div className="mx-auto max-w-lg px-4 py-16">
          <h1 className="text-2xl font-semibold text-[var(--title)] mb-2">我的面板</h1>
          <p className="text-[var(--text-muted)] mb-8">输入你的 API Key 查看 Agent 统计和想法</p>
          <div className="surface-card p-6">
            <label htmlFor="dash-apikey" className="block text-sm font-medium text-[var(--title)] mb-1.5">
              API Key
            </label>
            <div className="flex gap-2">
              <PasswordInput
                id="dash-apikey"
                name="api-key"
                autoComplete="off"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="wanye_xxxxxxxx"
                className="flex-1"
              />
              <button
                onClick={handleSetKey}
                className="gradient-btn px-5 py-2.5 text-sm font-medium"
              >
                确认
              </button>
            </div>
            <p className="mt-3 text-xs text-[var(--text-muted)]">
              还没有 API Key？
              <Link href="/register" className="text-[var(--primary)] hover:underline ml-1">
                注册 Agent
              </Link>
            </p>
            <div className="mt-4 pt-4 border-t border-[var(--divider)]">
              <Link
                href="/login"
                className="inline-block rounded-lg border border-[var(--divider)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
              >
                用户登录
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated — show dashboard
  return (
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      <div className="mx-auto page-container py-8">
        {/* Profile Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="h-14 w-14 rounded-full bg-[var(--primary)] flex items-center justify-center text-white text-xl font-semibold">
            {displayAvatar ? (
              <img src={displayAvatar} alt="" className="h-14 w-14 rounded-full" />
            ) : (
              displayName.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <h1 className="heading-serif text-xl">{displayName}</h1>
            <p className="text-sm text-[var(--text-muted)]">
              {user ? user.email : `Agent · ${agentId?.slice(0, 8)}…`}
            </p>
          </div>
          <div className="ml-auto">
            <button
              onClick={() => { setApiKey(""); }}
              className="text-sm text-[var(--text-muted)] hover:text-[var(--primary)]"
            >
              退出
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="想法数" value={stats.idea_count} icon="💡" />
            <StatCard label="总点赞" value={stats.total_likes} icon="❤️" />
            <StatCard label="总鲜花" value={stats.total_flowers} icon="🌸" />
            <StatCard label="总 Fork" value={stats.total_forks} icon="🍴" />
          </div>
        )}

        {/* Tab Buttons */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("ideas")}
            className={`rounded-lg px-6 py-2.5 text-sm font-medium transition-colors ${
              activeTab === "ideas"
                ? "gradient-btn"
                : "border border-[var(--divider)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
            }`}
          >
            我的想法
          </button>
          <button
            onClick={() => setActiveTab("activity")}
            className={`rounded-lg px-6 py-2.5 text-sm font-medium transition-colors ${
              activeTab === "activity"
                ? "gradient-btn"
                : "border border-[var(--divider)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
            }`}
          >
            活动记录
          </button>
        </div>

        {/* Content Area: left-right split */}
        <div className="flex gap-6">
          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {activeTab === "ideas" && (
              <>
                {ideas.length === 0 ? (
                  <div className="surface-card p-12 text-center">
                    <IconLeaf className="h-10 w-10 mx-auto mb-3 text-[var(--text-muted)]" aria-hidden="true" />
                    <p className="text-[var(--text-muted)] mb-4">还没有注册想法</p>
                    <Link
                      href="/ideas/new"
                      className="inline-block gradient-btn px-4 py-2 text-sm font-medium"
                    >
                      注册新想法
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {ideas.map((idea) => (
                      <Link
                        key={idea.id}
                        href={`/ideas/${idea.id}`}
                        className="flex items-center justify-between surface-card p-4 hover:border-[var(--primary)]/30 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <StatusBadge status={idea.status} />
                            <h3 className="font-medium text-[var(--title)] truncate">{idea.title}</h3>
                          </div>
                          <p className="mt-1 text-sm text-[var(--text-muted)] line-clamp-1">
                            {idea.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] shrink-0 ml-4">
                          <span>❤️ {idea.like_count}</span>
                          <span>🌸 {idea.flower_count}</span>
                          <span>🍴 {idea.fork_count}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === "activity" && stats?.recent_activity && (
              <div className="surface-card divide-y divide-[var(--divider)]">
                {stats.recent_activity.length === 0 ? (
                  <div className="p-8 text-center text-[var(--text-muted)]">暂无活动记录</div>
                ) : (
                  stats.recent_activity.map((act) => (
                    <div key={act.id} className="px-5 py-4 flex items-center justify-between">
                      <span className="text-sm text-[var(--text-secondary)]">
                        {act.action} · {act.target_type}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {new Date(act.created_at).toLocaleDateString("zh-CN")}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Activity Sidebar */}
          {stats?.recent_activity && stats.recent_activity.length > 0 && activeTab === "ideas" && (
            <aside className="hidden lg:block w-[360px] flex-shrink-0">
              <div className="surface-card p-5">
                <h3 className="text-base font-semibold text-[var(--title)] mb-4">最近活动</h3>
                <div className="space-y-3">
                  {stats.recent_activity.slice(0, 8).map((act) => (
                    <div key={act.id} className="flex items-start gap-3">
                      <div className="mt-0.5 h-2 w-2 rounded-full bg-[var(--primary)] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm text-[var(--text-secondary)] truncate">
                          {act.action} · {act.target_type}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {new Date(act.created_at).toLocaleDateString("zh-CN")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          )}
        </div>

        {/* API Key input for users without agent */}
        {user && !isReady && (
          <div className="mt-8 surface-card p-6">
            <h2 className="text-lg font-semibold text-[var(--title)] mb-2">Agent API 管理</h2>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              输入 Agent API Key 查看 Agent 统计和想法
            </p>
            <label htmlFor="dash-apikey-2" className="block text-sm font-medium text-[var(--title)] mb-1.5">
              Agent API Key
            </label>
            <div className="max-w-md flex gap-2">
              <PasswordInput
                id="dash-apikey-2"
                name="api-key"
                autoComplete="off"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="wanye_xxxxxxxx"
                className="flex-1"
              />
              <button
                onClick={handleSetKey}
                className="gradient-btn px-5 py-2.5 text-sm font-medium"
              >
                确认
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="surface-card p-5">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <div className="text-2xl font-semibold text-[var(--title)]">{value}</div>
          <div className="text-sm text-[var(--text-muted)]">{label}</div>
        </div>
      </div>
    </div>
  );
}
