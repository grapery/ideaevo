"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { userApi, notificationApi, authApi } from "@/lib/api-client";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PasswordInput } from "@/components/ui/password-input";
import { Switch } from "@/components/ui/switch";
import { ChatSession } from "@/lib/types";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api-error";
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
  const { user, loading: authLoading, refreshUser } = useAuth();
  const [section, setSection] = useState<Section>("profile");

  // Profile
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [backgroundUrl, setBackgroundUrl] = useState("");
  const [bio, setBio] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBackground, setUploadingBackground] = useState(false);

  // Delete account
  const [deletePwd, setDeletePwd] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletePhone, setDeletePhone] = useState("");
  const [deleteSmsCode, setDeleteSmsCode] = useState("");
  const [deleteSmsCooldown, setDeleteSmsCooldown] = useState(0);
  const [deleting, setDeleting] = useState(false);

  // Security
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdErrors, setPwdErrors] = useState<Record<string, string>>({});

  // Change phone
  const [changePhone, setChangePhone] = useState("");
  const [changeCode, setChangeCode] = useState("");
  const [changeCooldown, setChangeCooldown] = useState(0);
  const [changingPhone, setChangingPhone] = useState(false);

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
      setBackgroundUrl(user.background_url || "");
      setBio(user.bio || "");
      if (user.phone) setDeletePhone(user.phone);
    }
  }, [user]);

  useEffect(() => {
    if (deleteSmsCooldown <= 0) return;
    const t = setInterval(() => setDeleteSmsCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [deleteSmsCooldown]);

  useEffect(() => {
    if (changeCooldown <= 0) return;
    const t = setInterval(() => setChangeCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [changeCooldown]);

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
      setProfileErrors({ name: "显示名不能为空" });
      return;
    }
    setProfileErrors({});
    setSavingProfile(true);
    try {
      const res = await userApi.updateMyProfile({
        name: name.trim(),
        bio,
        avatar_url: avatarUrl.trim() || undefined,
        background_url: backgroundUrl.trim() || undefined,
      });
      if (res.user) await refreshUser();
      toast.success("资料已更新");
    } catch (err) {
      toast.error(getErrorMessage(err, "更新失败"));
    } finally {
      setSavingProfile(false);
    }
  }, [name, avatarUrl, backgroundUrl, bio, refreshUser]);

  const uploadImage = useCallback(
    async (kind: "avatar" | "background", file: File) => {
      const allowed = ["image/jpeg", "image/png", "image/webp"];
      if (!allowed.includes(file.type)) {
        toast.error("仅支持 JPEG、PNG、WebP 图片");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("图片不能超过 5MB");
        return;
      }
      const setUploading = kind === "avatar" ? setUploadingAvatar : setUploadingBackground;
      setUploading(true);
      try {
        const presign = await userApi.presignUpload(kind, file.type);
        const putRes = await fetch(presign.upload_url, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });
        if (!putRes.ok) throw new Error("上传失败");
        const patch: Parameters<typeof userApi.updateMyProfile>[0] = {
          ...(kind === "avatar"
            ? { avatar_url: presign.public_url, avatar_source: "upload" }
            : { background_url: presign.public_url }),
        };
        const res = await userApi.updateMyProfile(patch);
        if (kind === "avatar") setAvatarUrl(presign.public_url);
        else setBackgroundUrl(presign.public_url);
        if (res.user) await refreshUser();
        toast.success(kind === "avatar" ? "头像已更新" : "背景已更新");
      } catch (err) {
        toast.error(getErrorMessage(err, "上传失败"));
      } finally {
        setUploading(false);
      }
    },
    [refreshUser]
  );

  const resetAvatar = useCallback(async () => {
    try {
      const res = await userApi.resetAvatar();
      if (res.user?.avatar_url) setAvatarUrl(res.user.avatar_url);
      await refreshUser();
      toast.success("已恢复默认头像");
    } catch (err) {
      toast.error(getErrorMessage(err, "操作失败"));
    }
  }, [refreshUser]);

  const resetBackground = useCallback(async () => {
    try {
      const res = await userApi.resetBackground();
      if (res.user?.background_url) setBackgroundUrl(res.user.background_url);
      await refreshUser();
      toast.success("已恢复默认背景");
    } catch (err) {
      toast.error(getErrorMessage(err, "操作失败"));
    }
  }, [refreshUser]);

  const sendDeleteSms = useCallback(async () => {
    if (!deletePhone.trim()) {
      toast.error("请输入手机号");
      return;
    }
    try {
      await authApi.sendPhoneCode(deletePhone.trim(), "account_delete");
      toast.success("验证码已发送");
      setDeleteSmsCooldown(60);
    } catch (err) {
      toast.error(getErrorMessage(err, "发送失败"));
    }
  }, [deletePhone]);

  const deleteAccount = useCallback(async () => {
    if (!user) return;
    setDeleting(true);
    try {
      const payload: Parameters<typeof userApi.deleteAccount>[0] = {};
      if (user.auth_provider === "email") {
        if (!deletePwd) {
          toast.error("请输入密码确认");
          setDeleting(false);
          return;
        }
        payload.password = deletePwd;
      } else if (user.auth_provider === "google") {
        if (deleteConfirm !== "DELETE") {
          toast.error('请输入 DELETE 确认');
          setDeleting(false);
          return;
        }
        payload.confirm_text = deleteConfirm;
      } else if (user.auth_provider === "wechat") {
        if (!deletePhone || !deleteSmsCode) {
          toast.error("请完成手机验证");
          setDeleting(false);
          return;
        }
        payload.phone = deletePhone;
        payload.sms_code = deleteSmsCode;
      }
      await userApi.deleteAccount(payload);
      toast.success("账号已注销");
      window.location.href = "/";
    } catch (err) {
      toast.error(getErrorMessage(err, "注销失败"));
    } finally {
      setDeleting(false);
    }
  }, [user, deletePwd, deleteConfirm, deletePhone, deleteSmsCode]);

  const sendChangePhoneCode = useCallback(async () => {
    if (!changePhone.trim()) {
      toast.error("请输入新手机号");
      return;
    }
    try {
      await authApi.sendPhoneCode(changePhone.trim(), "change_phone");
      toast.success("验证码已发送");
      setChangeCooldown(60);
    } catch (err) {
      toast.error(getErrorMessage(err, "发送失败"));
    }
  }, [changePhone]);

  const verifyChangePhone = useCallback(async () => {
    if (!changePhone.trim() || !changeCode.trim()) {
      toast.error("请填写手机号和验证码");
      return;
    }
    setChangingPhone(true);
    try {
      await authApi.verifyPhone(changePhone.trim(), changeCode.trim());
      await refreshUser();
      setChangePhone("");
      setChangeCode("");
      toast.success("手机号已更新");
    } catch (err) {
      toast.error(getErrorMessage(err, "验证失败"));
    } finally {
      setChangingPhone(false);
    }
  }, [changePhone, changeCode, refreshUser]);

  const changePwd = useCallback(async () => {
    const errs: Record<string, string> = {};
    if (newPwd.length < 6) errs.newPwd = "新密码至少 6 个字符";
    if (newPwd !== confirmPwd) errs.confirmPwd = "两次新密码不一致";
    if (Object.keys(errs).length) {
      setPwdErrors(errs);
      return;
    }
    setPwdErrors({});
    setSavingPwd(true);
    try {
      await userApi.changePassword(oldPwd, newPwd);
      toast.success("密码已修改");
      setOldPwd("");
      setNewPwd("");
      setConfirmPwd("");
    } catch (err) {
      setPwdErrors({ oldPwd: getErrorMessage(err, "修改失败") });
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
      <div className="mx-auto page-container py-6">
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
            <div className="surface-card overflow-hidden mb-5">
              <div className="h-28 bg-[var(--primary-soft)] relative">
                {backgroundUrl ? (
                  <img src={backgroundUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-[var(--primary-soft)] to-[var(--teal)]/15" />
                )}
              </div>
              <div className="px-5 pb-5 -mt-10 flex items-end gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-2xl font-semibold text-[var(--primary)] overflow-hidden border-4 border-white shadow-sm">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    user.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="pb-1">
                  <div className="text-lg font-semibold text-[var(--title)]">{user.name}</div>
                  {user.email && (
                    <div className="text-sm text-[var(--text-muted)]">{user.email}</div>
                  )}
                  <div className="mt-1 text-xs text-[var(--text-muted)]">
                    关注 {user.following_count} · 粉丝 {user.follower_count}
                    {user.phone_verified && user.phone && ` · ${user.phone}`}
                  </div>
                </div>
              </div>
            </div>

            {section === "profile" && (
              <div className="surface-card p-6">
                <h2 className="text-base font-semibold text-[var(--title)] mb-4">基本信息</h2>
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">头像</label>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="gradient-btn px-4 py-2 text-sm font-medium cursor-pointer">
                        {uploadingAvatar ? "上传中…" : "上传图片"}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="sr-only"
                          disabled={uploadingAvatar}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) uploadImage("avatar", f);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={resetAvatar}
                        className="rounded-lg border border-[var(--divider)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                      >
                        恢复默认
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">背景图</label>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="gradient-btn px-4 py-2 text-sm font-medium cursor-pointer">
                        {uploadingBackground ? "上传中…" : "上传图片"}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="sr-only"
                          disabled={uploadingBackground}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) uploadImage("background", f);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={resetBackground}
                        className="rounded-lg border border-[var(--divider)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                      >
                        恢复默认
                      </button>
                    </div>
                  </div>
                  <FormField id="set-name" label="显示名" error={profileErrors.name}>
                    <Input
                      name="name"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => { setName(e.target.value); setProfileErrors({}); }}
                      hasError={!!profileErrors.name}
                    />
                  </FormField>
                  <FormField id="set-bio" label="简介" hint={`${bio.length} / 500 字符`}>
                    <Textarea
                      name="bio"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={3}
                      maxLength={500}
                      placeholder="一句话介绍自己 (例如：AI 研究者 / Agent 工具开发)"
                      className="resize-none"
                    />
                  </FormField>
                </div>
                <div className="mt-5 flex justify-end">
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

                {user.email && user.auth_provider !== "wechat" && (
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
                )}

                {user.auth_provider === "google" ? (
                  <div className="rounded-lg bg-[var(--bg-subtle)] p-4 text-sm text-[var(--text-muted)]">
                    你使用 Google 账号登录，无需设置密码。如需修改密码请前往 Google 账号管理。
                  </div>
                ) : user.auth_provider === "wechat" ? (
                  <div className="space-y-4">
                    <div className="rounded-lg bg-[var(--bg-subtle)] p-4 text-sm text-[var(--text-muted)]">
                      你使用微信扫码登录。
                      {user.phone_verified && user.phone
                        ? ` 已绑定手机 ${user.phone}`
                        : " 请完成手机验证以使用完整功能。"}
                    </div>
                    {user.phone_verified && (
                      <div className="rounded-lg border border-[var(--divider)] p-4 space-y-3 max-w-md">
                        <div className="text-sm font-medium text-[var(--title)]">更换绑定手机</div>
                        <FormField id="change-phone" label="新手机号">
                          <Input
                            type="tel"
                            value={changePhone}
                            onChange={(e) => setChangePhone(e.target.value)}
                            placeholder="新手机号"
                          />
                        </FormField>
                        <div className="flex gap-2 items-end">
                          <FormField id="change-code" label="短信验证码" className="flex-1">
                            <Input
                              value={changeCode}
                              onChange={(e) => setChangeCode(e.target.value)}
                              placeholder="短信验证码"
                            />
                          </FormField>
                          <button
                            type="button"
                            onClick={sendChangePhoneCode}
                            disabled={changeCooldown > 0}
                            className="shrink-0 rounded-lg border border-[var(--divider)] px-4 py-2 text-sm hover:bg-[var(--bg-subtle)] disabled:opacity-50"
                          >
                            {changeCooldown > 0 ? `${changeCooldown}s` : "获取验证码"}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={verifyChangePhone}
                          disabled={changingPhone}
                          className="gradient-btn px-4 py-2 text-sm font-medium disabled:opacity-50"
                        >
                          {changingPhone ? "更新中…" : "确认更换"}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <FormField id="set-old-pwd" label="当前密码" error={pwdErrors.oldPwd}>
                      <PasswordInput
                        name="old-password"
                        autoComplete="current-password"
                        value={oldPwd}
                        onChange={(e) => { setOldPwd(e.target.value); setPwdErrors({}); }}
                        hasError={!!pwdErrors.oldPwd}
                      />
                    </FormField>
                    <FormField id="set-new-pwd" label="新密码" error={pwdErrors.newPwd}>
                      <PasswordInput
                        name="new-password"
                        autoComplete="new-password"
                        value={newPwd}
                        onChange={(e) => { setNewPwd(e.target.value); setPwdErrors({}); }}
                        hasError={!!pwdErrors.newPwd}
                      />
                    </FormField>
                    <FormField id="set-confirm-pwd" label="确认新密码" error={pwdErrors.confirmPwd}>
                      <PasswordInput
                        name="confirm-password"
                        autoComplete="new-password"
                        value={confirmPwd}
                        onChange={(e) => { setConfirmPwd(e.target.value); setPwdErrors({}); }}
                        hasError={!!pwdErrors.confirmPwd}
                      />
                    </FormField>
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

                <div className="mt-8 pt-6 border-t border-[var(--divider)]">
                  <h3 className="text-sm font-semibold text-[var(--coral)] mb-2">危险区域</h3>
                  <p className="text-sm text-[var(--text-muted)] mb-4">
                    注销账号后，个人资料将被匿名化且无法恢复。
                  </p>
                  {user.auth_provider === "email" && (
                    <div className="space-y-3 max-w-md">
                      <FormField id="delete-pwd" label="输入密码确认">
                        <PasswordInput
                          value={deletePwd}
                          onChange={(e) => setDeletePwd(e.target.value)}
                          placeholder="输入密码确认"
                          autoComplete="current-password"
                        />
                      </FormField>
                    </div>
                  )}
                  {user.auth_provider === "google" && (
                    <div className="space-y-3 max-w-md">
                      <FormField id="delete-confirm" label='输入 DELETE 确认'>
                        <Input
                          value={deleteConfirm}
                          onChange={(e) => setDeleteConfirm(e.target.value)}
                          placeholder="DELETE"
                        />
                      </FormField>
                    </div>
                  )}
                  {user.auth_provider === "wechat" && (
                    <div className="space-y-3 max-w-md">
                      <FormField id="delete-phone" label="已绑定的手机号">
                        <Input
                          type="tel"
                          value={deletePhone}
                          onChange={(e) => setDeletePhone(e.target.value)}
                          placeholder="已绑定的手机号"
                        />
                      </FormField>
                      <div className="flex gap-2 items-end">
                        <FormField id="delete-sms" label="短信验证码" className="flex-1">
                          <Input
                            value={deleteSmsCode}
                            onChange={(e) => setDeleteSmsCode(e.target.value)}
                            placeholder="短信验证码"
                          />
                        </FormField>
                        <button
                          type="button"
                          onClick={sendDeleteSms}
                          disabled={deleteSmsCooldown > 0}
                          className="shrink-0 rounded-lg border border-[var(--divider)] px-4 py-2 text-sm hover:bg-[var(--bg-subtle)] disabled:opacity-50"
                        >
                          {deleteSmsCooldown > 0 ? `${deleteSmsCooldown}s` : "获取验证码"}
                        </button>
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={deleteAccount}
                    disabled={deleting}
                    className="mt-4 rounded-lg bg-[var(--coral)]/10 border border-[var(--coral)]/30 px-5 py-2 text-sm font-medium text-[var(--coral)] hover:bg-[var(--coral)]/15 disabled:opacity-50"
                  >
                    {deleting ? "注销中…" : "注销账号"}
                  </button>
                </div>
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
                        id={`pref-${row.key}`}
                        label={row.label}
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

function Toggle({
  id,
  label,
  on,
  onChange,
}: {
  id: string;
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return <Switch id={id} label={label} checked={on} onChange={onChange} />;
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
