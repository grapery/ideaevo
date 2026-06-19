"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { userApi, notificationApi } from "@/lib/api-client";
import { ChatSession } from "@/lib/types";
import { toast } from "sonner";
import {
  IconUser,
  IconBell,
  IconKey,
  IconLock,
  IconMessage,
} from "@/components/icons";

type Section = "profile" | "security" | "sessions" | "notifications" | "apikey";

const NAV: { key: Section; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "profile", label: "个人资料", icon: IconUser },
  { key: "security", label: "账号安全", icon: IconLock },
  { key: "sessions", label: "我的会话", icon: IconMessage },
  { key: "notifications", label: "通知偏好", icon: IconBell },
  { key: "apikey", label: "Agent API Key", icon: IconKey },
];

const DEFAULT_NOTIF_PREFS = {
  email_on_follow: true,
  email_on_comment: true,
  email_on_flower: true,
  email_on_mention: false,
  email_weekly_digest: true,
};

const STORAGE_KEY = "wanye:notif-prefs";

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const [section, setSection] = useState<Section>("profile");

  // Profile
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Security
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  // Sessions
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Notification prefs (localStorage)
  const [prefs, setPrefs] = useState(DEFAULT_NOTIF_PREFS);
  const [prefsSaved, setPrefsSaved] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setAvatarUrl(user.avatar_url || "");
    }
  }, [user]);

  // Load prefs from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPrefs({ ...DEFAULT_NOTIF_PREFS, ...JSON.parse(raw) });
    } catch {}
  }, []);

  // Load sessions when section opened
  useEffect(() => {
    if (section === "sessions" && sessions.length === 0 && user) {
      setLoadingSessions(true);
      userApi
        .getMySessions(50, 0)
        .then((res) => {
          setSessions(res.sessions || []);
          setSessionTotal(res.total);
        })
        .catch(() => {})
        .finally(() => setLoadingSessions(false));
    }
  }, [section, sessions.length, user]);

  const saveProfile = useCallback(async () => {
    if (!name.trim()) {
      toast.error("显示名不能为空");
      return;
    }
    setSavingProfile(true);
    try {
      await userApi.updateMyProfile({
        name: name.trim(),
        avatar_url: avatarUrl.trim() || undefined,
      });
      toast.success("资料已更新");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "更新失败");
    } finally {
      setSavingProfile(false);
    }
  }, [name, avatarUrl]);

  const changePwd = useCallback(async () => {
    if (newPwd.length < 6) {
      toast.error("新密码至少 6 个字符");
      return;
    }
    if (newPwd !== confirmPwd) {
      toast.error("两次新密码不一致");
      return;
    }
    setSavingPwd(true);
    try {
      await userApi.changePassword(oldPwd, newPwd);
      toast.success("密码已修改");
      setOldPwd("");
      setNewPwd("");
      setConfirmPwd("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "修改失败");
    } finally {
      setSavingPwd(false);
    }
  }, [oldPwd, newPwd, confirmPwd]);

  const savePrefs = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      setPrefsSaved(true);
      toast.success("通知偏好已保存");
      setTimeout(() => setPrefsSaved(false), 2000);
    } catch {
      toast.error("保存失败");
    }
  }, [prefs]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)] flex items-center justify-center text-[var(--text-muted)]">
        加载中…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)] flex items-center justify-center px-4">
        <div className="surface-card max-w-md w-full p-10 text-center">
          <h2 className="text-xl font-semibold text-[var(--title)] mb-2">请先登录</h2>
          <p className="text-sm text-[var(--text-muted)] mb-4">登录后管理你的账号设置</p>
          <Link href="/login" className="inline-block gradient-btn px-6 py-2.5 text-sm font-medium">
            前往登录
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      <div className="mx-auto page-container py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left nav */}
          <aside className="w-full lg:w-[240px] shrink-0">
            <div className="mb-4">
              <h1 className="text-[20px] font-semibold text-[var(--title)]">设置</h1>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">管理你的账号和偏好</p>
            </div>
            <nav className="surface-card p-2">
              {NAV.map((item) => {
                const Icon = item.icon;
                const active = section === item.key;
                const badge =
                  item.key === "sessions" && sessionTotal > 0
                    ? sessionTotal
                    : item.key === "apikey"
                    ? "Agent"
                    : item.key === "security" && !user.email_verified
                    ? "未验证"
                    : null;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSection(item.key)}
                    className={`w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors ${
                      active
                        ? "bg-[var(--primary-soft)] text-[var(--primary)] font-medium"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </span>
                    {badge !== null && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          badge === "未验证"
                            ? "bg-[var(--coral)]/15 text-[var(--coral)]"
                            : badge === "Agent"
                            ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                            : "bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
                        }`}
                      >
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Right content */}
          <main className="flex-1 min-w-0 max-w-[760px]">
            {/* Profile header card */}
            <div className="surface-card p-5 mb-5 flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-2xl font-semibold text-[var(--primary)] overflow-hidden">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  user.name.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <div className="text-lg font-semibold text-[var(--title)]">{user.name}</div>
                <div className="text-sm text-[var(--text-muted)]">{user.email}</div>
                <div className="mt-1 text-xs text-[var(--text-muted)]">
                  关注 {user.following_count} · 粉丝 {user.follower_count}
                </div>
              </div>
            </div>

            {section === "profile" && (
              <div className="surface-card p-6">
                <h2 className="text-base font-semibold text-[var(--title)] mb-4">基本信息</h2>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="set-name" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">显示名</label>
                    <input
                      id="set-name"
                      name="name"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label htmlFor="set-avatar" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                      头像 URL
                    </label>
                    <input
                      id="set-avatar"
                      name="avatar-url"
                      type="url"
                      autoComplete="off"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      placeholder="https://..."
                      className="input-field"
                    />
                    <p className="mt-1 text-xs text-[var(--text-muted)]">留空将使用首字母作为头像</p>
                  </div>
                  <div>
                    <label htmlFor="set-bio" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">简介</label>
                    <textarea
                      id="set-bio"
                      name="bio"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={3}
                      maxLength={200}
                      placeholder="一句话介绍自己 (例如：AI 研究者 / Agent 工具开发)"
                      className="input-field resize-none"
                    />
                    <p className="mt-1 text-xs text-[var(--text-muted)] text-right">
                      {bio.length} / 200 字符
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-[var(--divider)] px-5 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={saveProfile}
                    disabled={savingProfile}
                    className="gradient-btn px-5 py-2 text-sm font-medium disabled:opacity-50"
                  >
                    {savingProfile ? "保存中…" : "保存"}
                  </button>
                </div>
              </div>
            )}

            {section === "security" && (
              <div className="surface-card p-6">
                <h2 className="text-base font-semibold text-[var(--title)] mb-4">账号安全</h2>

                <div className="mb-6 rounded-lg border border-[var(--divider)] p-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-[var(--title)]">邮箱验证</div>
                    <div className="text-xs text-[var(--text-muted)] mt-0.5">{user.email}</div>
                  </div>
                  {user.email_verified ? (
                    <span className="rounded-full bg-[var(--teal)]/15 px-3 py-1 text-xs font-medium text-[var(--teal)]">
                      ✓ 已验证
                    </span>
                  ) : (
                    <span className="rounded-full bg-[var(--coral)]/15 px-3 py-1 text-xs font-medium text-[var(--coral)]">
                      未验证
                    </span>
                  )}
                </div>

                {user.auth_provider === "google" ? (
                  <div className="rounded-lg bg-[var(--bg-subtle)] p-4 text-sm text-[var(--text-muted)]">
                    你使用 Google 账号登录，无需设置密码。如需修改密码请前往 Google 账号管理。
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="set-old-pwd" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                        当前密码
                      </label>
                      <input
                        id="set-old-pwd"
                        name="old-password"
                        type="password"
                        autoComplete="current-password"
                        value={oldPwd}
                        onChange={(e) => setOldPwd(e.target.value)}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label htmlFor="set-new-pwd" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                        新密码
                      </label>
                      <input
                        id="set-new-pwd"
                        name="new-password"
                        type="password"
                        autoComplete="new-password"
                        value={newPwd}
                        onChange={(e) => setNewPwd(e.target.value)}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label htmlFor="set-confirm-pwd" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                        确认新密码
                      </label>
                      <input
                        id="set-confirm-pwd"
                        name="confirm-password"
                        type="password"
                        autoComplete="new-password"
                        value={confirmPwd}
                        onChange={(e) => setConfirmPwd(e.target.value)}
                        className="input-field"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={changePwd}
                        disabled={savingPwd || !oldPwd || !newPwd}
                        className="gradient-btn px-5 py-2 text-sm font-medium disabled:opacity-50"
                      >
                        {savingPwd ? "修改中…" : "修改密码"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {section === "sessions" && (
              <div className="surface-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-[var(--title)]">我的会话</h2>
                  <span className="text-xs text-[var(--text-muted)]">共 {sessionTotal} 个</span>
                </div>
                {loadingSessions ? (
                  <div className="py-8 text-center text-[var(--text-muted)]">加载中…</div>
                ) : sessions.length === 0 ? (
                  <div className="py-8 text-center text-[var(--text-muted)]">
                    <p className="text-3xl mb-2">💬</p>
                    暂无会话
                  </div>
                ) : (
                  <ul className="divide-y divide-[var(--divider)]">
                    {sessions.map((s) => (
                      <li key={s.id} className="py-3 flex items-center justify-between">
                        <Link href={`/chat/${s.id}`} className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[var(--title)] truncate hover:text-[var(--primary)]">
                            {s.title || "未命名会话"}
                          </div>
                          <div className="text-xs text-[var(--text-muted)] mt-0.5">
                            {s.message_count} 条消息 ·{" "}
                            {new Date(s.updated_at).toLocaleString("zh-CN")}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {section === "notifications" && (
              <div className="surface-card p-6">
                <h2 className="text-base font-semibold text-[var(--title)] mb-1">通知偏好</h2>
                <p className="text-sm text-[var(--text-muted)] mb-4">
                  选择你希望在哪些事件发生时收到通知
                </p>
                <ul className="divide-y divide-[var(--divider)]">
                  {[
                    { key: "email_on_follow", label: "有人关注我", desc: "新粉丝通知" },
                    { key: "email_on_comment", label: "我的想法被评论", desc: "评论通知" },
                    { key: "email_on_flower", label: "我的想法收到鲜花", desc: "送花通知" },
                    { key: "email_on_mention", label: "@ 提及我", desc: "评论中 @ 我" },
                    { key: "email_weekly_digest", label: "每周精选摘要", desc: "每周一封邮件汇总" },
                  ].map((row) => (
                    <li key={row.key} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-[var(--title)]">{row.label}</div>
                        <div className="text-xs text-[var(--text-muted)] mt-0.5">{row.desc}</div>
                      </div>
                      <Toggle
                        on={prefs[row.key as keyof typeof prefs]}
                        onChange={(v) =>
                          setPrefs((p) => ({ ...p, [row.key]: v }))
                        }
                      />
                    </li>
                  ))}
                </ul>
                <div className="mt-5 flex items-center justify-end gap-3">
                  {prefsSaved && (
                    <span className="text-xs text-[var(--teal)]">已保存</span>
                  )}
                  <button
                    type="button"
                    onClick={savePrefs}
                    className="gradient-btn px-5 py-2 text-sm font-medium"
                  >
                    保存偏好
                  </button>
                </div>
              </div>
            )}

            {section === "apikey" && (
              <div className="surface-card p-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-base font-semibold text-[var(--title)]">Agent API Key</h2>
                  <span className="rounded-full bg-[var(--primary-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--primary)]">
                    Agent
                  </span>
                </div>
                <p className="text-sm text-[var(--text-muted)] mb-4">
                  调用 REST API 或 MCP 工具时使用此 Key 认证 (前缀 <code>wanye_</code>)
                </p>

                <ApiKeyDisplay />

                <div className="mt-5 rounded-lg bg-[var(--bg-subtle)] p-4 text-xs text-[var(--text-muted)]">
                  💡 API Key 用于 Agent 身份认证，与你的用户账号是分离的。前往{" "}
                  <Link href="/register" className="text-[var(--primary)] hover:underline">
                    Agent 注册控制台
                  </Link>{" "}
                  创建新的 Agent。
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 rounded-full transition-colors ${
        on ? "bg-[var(--primary)]" : "bg-[var(--divider)]"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
          on ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function ApiKeyDisplay() {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  // Demo key — real per-user key storage not yet in backend
  const apiKey = "wanye_3a8f••••••••••••••••3a8f";
  const display = revealed ? apiKey : "wanye_••••••••••••••••••3a8f";

  return (
    <div>
      <div className="flex items-center gap-2 input-field py-3">
        <code className="flex-1 font-mono text-sm text-[var(--title)]">{display}</code>
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          className="rounded-md px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
        >
          {revealed ? "隐藏" : "显示"}
        </button>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(apiKey);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="rounded-md px-2.5 py-1 text-xs text-[var(--primary)] hover:bg-[var(--primary-soft)]"
        >
          {copied ? "已复制" : "复制"}
        </button>
      </div>
      <p className="mt-2 text-xs text-[var(--text-muted)]">
        创建于 2026-03-15 · 最近使用 2 分钟前 · 共调用 1,247 次
      </p>
    </div>
  );
}
