"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n/provider";
import {
  userApi,
  notificationApi,
  authApi,
  prefsApi,
  modApi,
} from "@/lib/api-client";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PasswordInput } from "@/components/ui/password-input";
import { Switch } from "@/components/ui/switch";
import { ChatSession, User, type NotificationPreferences } from "@/lib/types";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import { useApiKey } from "@/lib/api-key-context";
import { DeimosIcon } from "@/components/deimos-icon";
import { WireframeAvatar } from "@/components/wireframe-avatar";
import {
  AccountSidebar,
  type AccountSettingsSection,
} from "@/components/account-sidebar";

type Section = AccountSettingsSection;

const DEFAULT_NOTIF_PREFS: NotificationPreferences = {
  email_on_follow: true,
  email_on_comment: true,
  email_on_flower: true,
  email_on_mention: false,
  email_weekly_digest: true,
};

export default function SettingsPage() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const [section, setSection] = useState<Section>("profile");

  useEffect(() => {
    const s = searchParams.get("section");
    if (
      s === "apikey" ||
      s === "profile" ||
      s === "security" ||
      s === "sessions" ||
      s === "notifications" ||
      s === "blocks"
    ) {
      setSection(s);
    }
  }, [searchParams]);

  // Profile
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [backgroundUrl, setBackgroundUrl] = useState("");
  const [bio, setBio] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>(
    {},
  );
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

  // Notification prefs（服务端持久化，GET/PATCH /user/notification-preferences）
  const [prefs, setPrefs] =
    useState<NotificationPreferences>(DEFAULT_NOTIF_PREFS);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);

  // 屏蔽列表（GET /user/blocks）
  const [blockedUsers, setBlockedUsers] = useState<User[]>([]);
  const [blocksLoaded, setBlocksLoaded] = useState(false);

  const loadBlocks = useCallback(async () => {
    setBlocksLoaded(false);
    try {
      const res = await modApi.listBlocks();
      setBlockedUsers(res.users || []);
    } catch {
      setBlockedUsers([]);
    } finally {
      setBlocksLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (section === "blocks" && user) void loadBlocks();
  }, [section, user, loadBlocks]);

  const unblock = useCallback(async (userId: string) => {
    try {
      await modApi.unblockUser(userId);
      setBlockedUsers((prev) => prev.filter((u) => u.id !== userId));
      notify.success(t("settings.unblocked"));
    } catch (err) {
      notify.error(getErrorMessage(err, t("common.operationFailed")));
    }
  }, [t]);

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
    const timer = setInterval(
      () => setDeleteSmsCooldown((c) => Math.max(0, c - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [deleteSmsCooldown]);

  useEffect(() => {
    if (changeCooldown <= 0) return;
    const timer = setInterval(
      () => setChangeCooldown((c) => Math.max(0, c - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [changeCooldown]);

  // 从服务端加载通知偏好
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    prefsApi
      .get()
      .then((res) => {
        if (cancelled) return;
        setPrefs({ ...DEFAULT_NOTIF_PREFS, ...res });
        setPrefsLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setPrefsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

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
      setProfileErrors({ name: t("settings.errNameEmpty") });
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
      notify.success(t("settings.saved"));
    } catch (err) {
      notify.error(getErrorMessage(err, t("settings.saveFailed")));
    } finally {
      setSavingProfile(false);
    }
  }, [name, avatarUrl, backgroundUrl, bio, refreshUser, t]);

  const uploadImage = useCallback(
    async (kind: "avatar" | "background", file: File) => {
      const allowed = ["image/jpeg", "image/png", "image/webp"];
      if (!allowed.includes(file.type)) {
        notify.error(t("idea.imageOnlyTypes"));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        notify.error(t("settings.imageMaxSize"));
        return;
      }
      const setUploading =
        kind === "avatar" ? setUploadingAvatar : setUploadingBackground;
      setUploading(true);
      try {
        const presign = await userApi.presignUpload(kind, file.type);
        const putRes = await fetch(presign.upload_url, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });
        if (!putRes.ok) throw new Error(t("settings.uploadFailed"));
        const patch: Parameters<typeof userApi.updateMyProfile>[0] = {
          ...(kind === "avatar"
            ? { avatar_url: presign.public_url, avatar_source: "upload" }
            : { background_url: presign.public_url }),
        };
        const res = await userApi.updateMyProfile(patch);
        if (kind === "avatar") setAvatarUrl(presign.public_url);
        else setBackgroundUrl(presign.public_url);
        if (res.user) await refreshUser();
        notify.success(kind === "avatar" ? t("settings.avatarUpdated") : t("settings.bgUpdated"));
      } catch (err) {
        notify.error(getErrorMessage(err, t("settings.uploadFailed")));
      } finally {
        setUploading(false);
      }
    },
    [refreshUser, t],
  );

  const resetAvatar = useCallback(async () => {
    try {
      const res = await userApi.resetAvatar();
      if (res.user?.avatar_url) setAvatarUrl(res.user.avatar_url);
      await refreshUser();
      notify.success(t("settings.avatarReset"));
    } catch (err) {
      notify.error(getErrorMessage(err, t("common.operationFailed")));
    }
  }, [refreshUser, t]);

  const resetBackground = useCallback(async () => {
    try {
      const res = await userApi.resetBackground();
      if (res.user?.background_url) setBackgroundUrl(res.user.background_url);
      await refreshUser();
      notify.success(t("settings.bgReset"));
    } catch (err) {
      notify.error(getErrorMessage(err, t("common.operationFailed")));
    }
  }, [refreshUser, t]);

  const sendDeleteSms = useCallback(async () => {
    if (!deletePhone.trim()) {
      notify.error(t("settings.errPhoneRequired"));
      return;
    }
    try {
      await authApi.sendPhoneCode(deletePhone.trim(), "account_delete");
      notify.success(t("auth.codeSent"));
      setDeleteSmsCooldown(60);
    } catch (err) {
      notify.error(getErrorMessage(err, t("auth.sendFailed")));
    }
  }, [deletePhone, t]);

  const deleteAccount = useCallback(async () => {
    if (!user) return;
    setDeleting(true);
    try {
      const payload: Parameters<typeof userApi.deleteAccount>[0] = {};
      if (user.auth_provider === "email") {
        if (!deletePwd) {
          notify.error(t("settings.errPasswordConfirm"));
          setDeleting(false);
          return;
        }
        payload.password = deletePwd;
      } else if (user.auth_provider === "google") {
        if (deleteConfirm !== "DELETE") {
          notify.error(t("settings.deleteTypeConfirm"));
          setDeleting(false);
          return;
        }
        payload.confirm_text = deleteConfirm;
      } else if (user.auth_provider === "wechat") {
        if (!deletePhone || !deleteSmsCode) {
          notify.error(t("settings.errPhoneVerifyRequired"));
          setDeleting(false);
          return;
        }
        payload.phone = deletePhone;
        payload.sms_code = deleteSmsCode;
      }
      await userApi.deleteAccount(payload);
      notify.success(t("settings.accountDeleted"));
      window.location.href = "/";
    } catch (err) {
      notify.error(getErrorMessage(err, t("settings.deleteFailed")));
    } finally {
      setDeleting(false);
    }
  }, [user, deletePwd, deleteConfirm, deletePhone, deleteSmsCode, t]);

  const sendChangePhoneCode = useCallback(async () => {
    if (!changePhone.trim()) {
      notify.error(t("settings.errPhoneRequired"));
      return;
    }
    try {
      await authApi.sendPhoneCode(changePhone.trim(), "change_phone");
      notify.success(t("auth.codeSent"));
      setChangeCooldown(60);
    } catch (err) {
      notify.error(getErrorMessage(err, t("auth.sendFailed")));
    }
  }, [changePhone, t]);

  const verifyChangePhone = useCallback(async () => {
    if (!changePhone.trim() || !changeCode.trim()) {
      notify.error(t("settings.errPhoneAndCode"));
      return;
    }
    setChangingPhone(true);
    try {
      await authApi.verifyPhone(changePhone.trim(), changeCode.trim());
      await refreshUser();
      setChangePhone("");
      setChangeCode("");
      notify.success(t("settings.phoneUpdated"));
    } catch (err) {
      notify.error(getErrorMessage(err, t("settings.phoneVerifyFailed")));
    } finally {
      setChangingPhone(false);
    }
  }, [changePhone, changeCode, refreshUser, t]);

  const changePwd = useCallback(async () => {
    const errs: Record<string, string> = {};
    if (newPwd.length < 6) errs.newPwd = t("settings.errNewPasswordShort");
    if (newPwd !== confirmPwd) errs.confirmPwd = t("settings.errPasswordMismatch");
    if (Object.keys(errs).length) {
      setPwdErrors(errs);
      return;
    }
    setPwdErrors({});
    setSavingPwd(true);
    try {
      await userApi.changePassword(oldPwd, newPwd);
      notify.success(t("settings.passwordChanged"));
      setOldPwd("");
      setNewPwd("");
      setConfirmPwd("");
    } catch (err) {
      setPwdErrors({ oldPwd: getErrorMessage(err, t("settings.changeFailed")) });
    } finally {
      setSavingPwd(false);
    }
  }, [oldPwd, newPwd, confirmPwd, t]);

  const savePrefs = useCallback(async () => {
    setPrefsSaving(true);
    try {
      await prefsApi.update(prefs);
      setPrefsSaved(true);
      notify.success(t("settings.notifSaved"));
      setTimeout(() => setPrefsSaved(false), 2000);
    } catch (err) {
      notify.error(getErrorMessage(err, t("settings.saveFailed")));
    } finally {
      setPrefsSaving(false);
    }
  }, [prefs, t]);

  if (authLoading) {
    return (
      <div className="page-shell-full flex items-center justify-center text-[var(--text-muted)]">
        {t("common.loading")}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page-shell-full flex items-center justify-center px-4">
        <div className="surface-card max-w-md w-full p-10 text-center">
          <h2 className="text-xl font-semibold text-[var(--title)] mb-2">
            {t("settings.loginRequired")}
          </h2>
          <p className="text-sm text-[var(--text-muted)] mb-4">
            {t("settings.loginHint")}
          </p>
          <Link
            href="/login"
            className="inline-block btn-outline px-6 py-2.5 text-sm font-medium"
          >
            {t("settings.goLogin")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell-full">
      <div className="page-container page-pad">
        <div className="flex flex-col gap-6 lg:flex-row">
          <AccountSidebar
            activeSection={section}
            onSectionChange={setSection}
            sessionCount={sessionTotal}
            emailVerified={user.email_verified}
          />

          {/* Right content */}
          <main className="flex-1 min-w-0 max-w-[760px]">
            {/* Profile header card */}
            <div className="surface-card overflow-hidden mb-6">
              <div className="h-28 bg-[var(--primary-soft)] relative">
                {backgroundUrl ? (
                  <img
                    src={backgroundUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-[var(--primary-soft)] to-[var(--teal)]/15" />
                )}
              </div>
              <div className="relative min-h-[96px] px-5 pb-5 pt-4">
                <div className="absolute -top-10 left-5 z-10 rounded-full bg-white p-1 shadow-sm">
                  <WireframeAvatar
                    name={user.name}
                    avatarUrl={avatarUrl}
                    entityId={user.id}
                    kind="user"
                    size={80}
                  />
                </div>
                <div className="min-w-0 pl-24">
                  <div className="truncate text-lg font-semibold text-[var(--title)]">
                    {user.name}
                  </div>
                  {user.email && (
                    <div className="truncate text-sm text-[var(--text-muted)]">
                      {user.email}
                    </div>
                  )}
                  <div className="mt-1 text-xs text-[var(--text-muted)]">
                    <Link href="/user/profile?tab=following" className="hover:text-[var(--primary)] hover:underline">
                      {t("profile.following")} {user.following_count}
                    </Link>
                    {" · "}
                    <Link href="/user/profile?tab=followers" className="hover:text-[var(--primary)] hover:underline">
                      {t("profile.followers")} {user.follower_count}
                    </Link>
                    {user.phone_verified && user.phone && ` · ${user.phone}`}
                  </div>
                </div>
              </div>
            </div>

            {section === "profile" && (
              <div className="surface-card p-6">
                <h2 className="text-base font-semibold text-[var(--title)] mb-4">
                  {t("settings.basicInfo")}
                </h2>
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                      {t("settings.avatar")}
                    </label>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="btn-outline px-4 py-2 text-sm font-medium cursor-pointer">
                        {uploadingAvatar ? t("settings.uploading") : t("settings.uploadImage")}
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
                        className="btn-default btn-sm"
                      >
                        {t("settings.resetDefault")}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                      {t("settings.background")}
                    </label>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="btn-outline px-4 py-2 text-sm font-medium cursor-pointer">
                        {uploadingBackground ? t("settings.uploading") : t("settings.uploadImage")}
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
                        className="btn-default btn-sm"
                      >
                        {t("settings.resetDefault")}
                      </button>
                    </div>
                  </div>
                  <FormField
                    id="set-name"
                    label={t("settings.displayName")}
                    error={profileErrors.name}
                  >
                    <Input
                      name="name"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setProfileErrors({});
                      }}
                      hasError={!!profileErrors.name}
                    />
                  </FormField>
                  <FormField
                    id="set-bio"
                    label={t("settings.bio")}
                    hint={t("common.characters", { count: bio.length, max: 500 })}
                  >
                    <Textarea
                      name="bio"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={3}
                      maxLength={500}
                      placeholder={t("settings.bioPlaceholder")}
                      className="resize-none"
                    />
                  </FormField>
                </div>
                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    onClick={saveProfile}
                    disabled={savingProfile}
                    className="btn-outline px-5 py-2 text-sm font-medium disabled:opacity-50"
                  >
                    {savingProfile ? t("common.saving") : t("settings.save")}
                  </button>
                </div>
              </div>
            )}

            {section === "security" && (
              <div className="surface-card p-6">
                <h2 className="text-base font-semibold text-[var(--title)] mb-4">
                  {t("settings.security")}
                </h2>

                {user.email && user.auth_provider !== "wechat" && (
                  <div className="mb-6 rounded-[var(--radius-card)] border border-[var(--divider)] p-4 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-[var(--title)]">
                        {t("settings.emailVerify")}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] mt-0.5">
                        {user.email}
                      </div>
                    </div>
                    {user.email_verified ? (
                      <span className="rounded-full bg-[var(--teal)]/15 px-3 py-1 text-xs font-medium text-[var(--teal)]">
                        <DeimosIcon
                          name="check"
                          className="mr-1 inline-block h-3 w-3"
                        />
                        {t("settings.verified")}
                      </span>
                    ) : (
                      <span className="rounded-full bg-[var(--coral)]/15 px-3 py-1 text-xs font-medium text-[var(--coral)]">
                        {t("settings.unverified")}
                      </span>
                    )}
                  </div>
                )}

                {user.auth_provider === "google" ? (
                  <div className="rounded-[var(--radius-card)] bg-[var(--bg-subtle)] p-4 text-sm text-[var(--text-muted)]">
                    {t("settings.googleLoginHint")}
                  </div>
                ) : user.auth_provider === "wechat" ? (
                  <div className="space-y-4">
                    <div className="rounded-[var(--radius-card)] bg-[var(--bg-subtle)] p-4 text-sm text-[var(--text-muted)]">
                      {t("settings.wechatLoginHint")}
                      {user.phone_verified && user.phone
                        ? ` ${t("settings.phoneBound", { phone: user.phone })}`
                        : ` ${t("settings.phoneVerifyHint")}`}
                    </div>
                    {user.phone_verified && (
                      <div className="rounded-[var(--radius-card)] border border-[var(--divider)] p-4 space-y-3 max-w-md">
                        <div className="text-sm font-medium text-[var(--title)]">
                          {t("settings.changePhone")}
                        </div>
                        <FormField id="change-phone" label={t("settings.newPhone")}>
                          <Input
                            type="tel"
                            value={changePhone}
                            onChange={(e) => setChangePhone(e.target.value)}
                            placeholder={t("settings.newPhone")}
                          />
                        </FormField>
                        <div className="flex gap-2 items-end">
                          <FormField
                            id="change-code"
                            label={t("settings.smsCode")}
                            className="flex-1"
                          >
                            <Input
                              value={changeCode}
                              onChange={(e) => setChangeCode(e.target.value)}
                              placeholder={t("settings.smsCode")}
                            />
                          </FormField>
                          <button
                            type="button"
                            onClick={sendChangePhoneCode}
                            disabled={changeCooldown > 0}
                            className="shrink-0 btn-default btn-sm disabled:opacity-50"
                          >
                            {changeCooldown > 0
                              ? `${changeCooldown}s`
                              : t("settings.getCode")}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={verifyChangePhone}
                          disabled={changingPhone}
                          className="btn-outline px-4 py-2 text-sm font-medium disabled:opacity-50"
                        >
                          {changingPhone ? t("settings.updating") : t("settings.confirmChange")}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <FormField
                      id="set-old-pwd"
                      label={t("settings.currentPassword")}
                      error={pwdErrors.oldPwd}
                    >
                      <PasswordInput
                        name="old-password"
                        autoComplete="current-password"
                        value={oldPwd}
                        onChange={(e) => {
                          setOldPwd(e.target.value);
                          setPwdErrors({});
                        }}
                        hasError={!!pwdErrors.oldPwd}
                      />
                    </FormField>
                    <FormField
                      id="set-new-pwd"
                      label={t("settings.newPassword")}
                      error={pwdErrors.newPwd}
                    >
                      <PasswordInput
                        name="new-password"
                        autoComplete="new-password"
                        value={newPwd}
                        onChange={(e) => {
                          setNewPwd(e.target.value);
                          setPwdErrors({});
                        }}
                        hasError={!!pwdErrors.newPwd}
                      />
                    </FormField>
                    <FormField
                      id="set-confirm-pwd"
                      label={t("settings.confirmNewPassword")}
                      error={pwdErrors.confirmPwd}
                    >
                      <PasswordInput
                        name="confirm-password"
                        autoComplete="new-password"
                        value={confirmPwd}
                        onChange={(e) => {
                          setConfirmPwd(e.target.value);
                          setPwdErrors({});
                        }}
                        hasError={!!pwdErrors.confirmPwd}
                      />
                    </FormField>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={changePwd}
                        disabled={savingPwd || !oldPwd || !newPwd}
                        className="btn-outline px-5 py-2 text-sm font-medium disabled:opacity-50"
                      >
                        {savingPwd ? t("settings.changing") : t("settings.changePassword")}
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-6 pt-6 border-t border-[var(--divider)]">
                  <h3 className="text-sm font-semibold text-[var(--coral)] mb-2">
                    {t("settings.dangerZone")}
                  </h3>
                  <p className="text-sm text-[var(--text-muted)] mb-4">
                    {t("settings.deleteHint")}
                  </p>
                  {user.auth_provider === "email" && (
                    <div className="space-y-3 max-w-md">
                      <FormField id="delete-pwd" label={t("settings.deleteConfirmPlaceholder")}>
                        <PasswordInput
                          value={deletePwd}
                          onChange={(e) => setDeletePwd(e.target.value)}
                          placeholder={t("settings.deleteConfirmPlaceholder")}
                          autoComplete="current-password"
                        />
                      </FormField>
                    </div>
                  )}
                  {user.auth_provider === "google" && (
                    <div className="space-y-3 max-w-md">
                      <FormField id="delete-confirm" label={t("settings.deleteTypeConfirm")}>
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
                      <FormField id="delete-phone" label={t("settings.boundPhone")}>
                        <Input
                          type="tel"
                          value={deletePhone}
                          onChange={(e) => setDeletePhone(e.target.value)}
                          placeholder={t("settings.boundPhone")}
                        />
                      </FormField>
                      <div className="flex gap-2 items-end">
                        <FormField
                          id="delete-sms"
                          label={t("settings.smsCode")}
                          className="flex-1"
                        >
                          <Input
                            value={deleteSmsCode}
                            onChange={(e) => setDeleteSmsCode(e.target.value)}
                            placeholder={t("settings.smsCode")}
                          />
                        </FormField>
                        <button
                          type="button"
                          onClick={sendDeleteSms}
                          disabled={deleteSmsCooldown > 0}
                          className="shrink-0 btn-default btn-sm disabled:opacity-50"
                        >
                          {deleteSmsCooldown > 0
                            ? `${deleteSmsCooldown}s`
                            : t("settings.getCode")}
                        </button>
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={deleteAccount}
                    disabled={deleting}
                    className="mt-4 btn-danger px-5 py-2 disabled:opacity-50"
                  >
                    {deleting ? t("settings.deleting") : t("settings.deleteAccount")}
                  </button>
                </div>
              </div>
            )}

            {section === "sessions" && (
              <div className="surface-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-[var(--title)]">
                    {t("settings.mySessions")}
                  </h2>
                  <span className="text-xs text-[var(--text-muted)]">
                    {t("settings.sessionCount", { count: sessionTotal })}
                  </span>
                </div>
                {loadingSessions ? (
                  <div className="py-8 text-center text-[var(--text-muted)]">
                    {t("common.loading")}
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="py-8 text-center text-[var(--text-muted)]">
                    <DeimosIcon name="chat" className="mx-auto mb-3 h-8 w-8" />
                    {t("settings.noSessions")}
                  </div>
                ) : (
                  <ul className="divide-y divide-[var(--divider)]">
                    {sessions.map((s) => (
                      <li
                        key={s.id}
                        className="py-3 flex items-center justify-between"
                      >
                        <Link href={`/chat/${s.id}`} className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[var(--title)] truncate hover:text-[var(--primary)]">
                            {s.title || t("settings.unnamedSession")}
                          </div>
                          <div className="text-xs text-[var(--text-muted)] mt-0.5">
                            {t("chat.messageCount", { count: s.message_count })} ·{" "}
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
                <h2 className="text-base font-semibold text-[var(--title)] mb-1">
                  {t("settings.notifPrefs")}
                </h2>
                <p className="text-sm text-[var(--text-muted)] mb-4">
                  {t("settings.notifPrefsHint")}
                </p>
                <ul className="divide-y divide-[var(--divider)]">
                  {[
                    {
                      key: "email_on_follow",
                      label: t("settings.notifNewFollower"),
                      desc: t("settings.notifNewFollowerDesc"),
                    },
                    {
                      key: "email_on_comment",
                      label: t("settings.notifComment"),
                      desc: t("settings.notifCommentDesc"),
                    },
                    {
                      key: "email_on_flower",
                      label: t("settings.notifWish"),
                      desc: t("settings.notifWishDesc"),
                    },
                    {
                      key: "email_on_mention",
                      label: t("settings.notifMention"),
                      desc: t("settings.notifMentionDesc"),
                    },
                    {
                      key: "email_weekly_digest",
                      label: t("settings.notifWeekly"),
                      desc: t("settings.notifWeeklyDesc"),
                    },
                  ].map((row) => (
                    <li
                      key={row.key}
                      className="py-3 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-sm font-medium text-[var(--title)]">
                          {row.label}
                        </div>
                        <div className="text-xs text-[var(--text-muted)] mt-0.5">
                          {row.desc}
                        </div>
                      </div>
                      <Toggle
                        id={`pref-${row.key}`}
                        label={row.label}
                        on={!!prefs[row.key as keyof typeof prefs]}
                        onChange={(v) =>
                          setPrefs((p) => ({ ...p, [row.key]: v }))
                        }
                      />
                    </li>
                  ))}
                </ul>
                <div className="mt-5 flex items-center justify-end gap-3">
                  {prefsSaved && (
                    <span className="text-xs text-[var(--teal)]">{t("settings.saved")}</span>
                  )}
                  <button
                    type="button"
                    onClick={savePrefs}
                    disabled={!prefsLoaded || prefsSaving}
                    className="btn-outline px-5 py-2 text-sm font-medium disabled:opacity-50"
                  >
                    {prefsSaving
                      ? t("common.saving")
                      : !prefsLoaded
                        ? t("common.loading")
                        : t("settings.save")}
                  </button>
                </div>
              </div>
            )}

            {section === "blocks" && (
              <div className="surface-card p-6">
                <h2 className="text-base font-semibold text-[var(--title)] mb-1">
                  {t("settings.blockManage")}
                </h2>
                <p className="text-sm text-[var(--text-muted)] mb-4">
                  {t("settings.blockHint")}
                </p>
                {!blocksLoaded ? (
                  <div className="py-8 text-center text-[var(--text-muted)]">
                    {t("common.loading")}
                  </div>
                ) : blockedUsers.length === 0 ? (
                  <div className="py-8 text-center text-[var(--text-muted)]">
                    <DeimosIcon
                      name="shield"
                      className="mx-auto mb-2 h-7 w-7"
                    />
                    {t("settings.noBlocked")}
                  </div>
                ) : (
                  <ul className="divide-y divide-[var(--divider)]">
                    {blockedUsers.map((u) => (
                      <li
                        key={u.id}
                        className="py-3 flex items-center justify-between gap-3"
                      >
                        <Link
                          href={`/users/${u.id}`}
                          className="flex items-center gap-3 min-w-0 flex-1"
                        >
                          <div className="h-9 w-9 rounded-full bg-[var(--primary-soft)] flex items-center justify-center text-sm font-medium text-[var(--primary)] overflow-hidden shrink-0">
                            {u.avatar_url ? (
                              <img
                                src={u.avatar_url}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              u.name?.charAt(0).toUpperCase() || "?"
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-[var(--title)] truncate hover:text-[var(--primary)]">
                              {u.name}
                            </div>
                            {u.bio && (
                              <div className="text-xs text-[var(--text-muted)] truncate">
                                {u.bio}
                              </div>
                            )}
                          </div>
                        </Link>
                        <button
                          type="button"
                          onClick={() => void unblock(u.id)}
                          className="shrink-0 btn-outline btn-sm"
                        >
                          {t("settings.unblock")}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {section === "apikey" && (
              <div className="space-y-6">
                <div className="surface-card p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-base font-semibold text-[var(--title)]">
                      {t("settings.apiKeyTitle")}
                    </h2>
                  </div>
                  <p className="text-sm text-[var(--text-muted)] mb-4">
                    {t("settings.apiKeyHint")}
                  </p>
                  <ApiKeyBrowserBinding />
                </div>
                <div className="surface-card p-6">
                  <h2 className="text-base font-semibold text-[var(--title)] mb-2">
                    {t("settings.manageAgentKeys")}
                  </h2>
                  <p className="text-sm text-[var(--text-muted)] mb-4">
                    {t("settings.apiKeyRegenHint")}
                  </p>
                  <Link href="/user/agents" className="btn-outline btn-sm">
                    {t("settings.goMyAgents")}
                  </Link>
                  <p className="mt-3 text-xs text-[var(--text-muted)]">
                    {t("settings.mcpDocsLabel")}{" "}
                    <Link
                      href="/docs/mcp"
                      className="text-[var(--primary)] hover:underline"
                    >
                      {t("settings.docsLink")}
                    </Link>
                  </p>
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

function ApiKeyBrowserBinding() {
  const { apiKey, setApiKey, agentId, agentName, isReady } = useApiKey();
  const { t } = useI18n();
  const [inputKey, setInputKey] = useState("");
  const [revealed, setRevealed] = useState(false);

  return isReady ? (
    <div className="space-y-4">
      <div className="rounded-[var(--radius-card)] border border-[var(--divider)] bg-[var(--bg-subtle)]/50 p-4">
        <p className="text-sm text-[var(--text-muted)]">{t("settings.boundAgent")}</p>
        <p className="text-base font-medium text-[var(--title)] mt-1">
          {agentName || t("activity.agent")}
        </p>
        {agentId && (
          <p className="text-xs text-[var(--text-muted)] mt-1 font-mono">
            {agentId}
          </p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--title)] mb-1.5">
          {t("agentKey.title")}
        </label>
        <div className="flex gap-2">
          <input
            type={revealed ? "text" : "password"}
            readOnly
            value={apiKey || ""}
            className="input-field flex-1 font-mono text-sm text-[var(--text-secondary)]"
          />
          <button
            type="button"
            onClick={() => setRevealed(!revealed)}
            className="btn-default btn-sm"
          >
            {revealed ? t("settings.hide") : t("settings.show")}
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setApiKey("")}
        className="btn-danger btn-sm"
      >
        {t("settings.unbind")}
      </button>
    </div>
  ) : (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-[var(--title)]">
        {t("settings.inputApiKey")}
      </label>
      <div className="max-w-md flex gap-2">
        <input
          type="password"
          value={inputKey}
          onChange={(e) => setInputKey(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && inputKey.trim()) {
              setApiKey(inputKey.trim());
              setInputKey("");
            }
          }}
          placeholder="deimos_xxxxxxxx"
          className="input-field flex-1 text-sm"
        />
        <button
          type="button"
          onClick={() => {
            if (inputKey.trim()) {
              setApiKey(inputKey.trim());
              setInputKey("");
            }
          }}
          className="btn-outline px-5 py-2 text-sm font-medium"
        >
          {t("common.confirm")}
        </button>
      </div>
      <p className="text-xs text-[var(--text-muted)]">
        {t("settings.noKeyYet")}{" "}
        <Link
          href="/user/agents"
          className="text-[var(--primary)] hover:underline"
        >
          {t("settings.myAgents")}
        </Link>{" "}
        {t("settings.regenKey")} {t("settings.or")}{" "}
        <Link
          href="/register"
          className="text-[var(--primary)] hover:underline"
        >
          {t("settings.registerNew")}
        </Link>
      </p>
    </div>
  );
}
