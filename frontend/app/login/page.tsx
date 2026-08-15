"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n/provider";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import { AuthSplitShell } from "@/components/auth-split-shell";
import { AuthOAuthButtons } from "@/components/auth-oauth-buttons";
import { FormField, ButtonSpinner } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

export default function LoginPage() {
  const { t } = useI18n();
  const { login, loginWithGoogle, loginWithWeChat, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 仅接受站内相对路径，防止开放跳转
  const rawReturnUrl = searchParams.get("returnUrl");
  const returnUrl = rawReturnUrl && /^\/(?!\/)/.test(rawReturnUrl) ? rawReturnUrl : "/dashboard";

  useEffect(() => {
    if (user) router.push(returnUrl);
  }, [user, router, returnUrl]);

  const oauthError = searchParams.get("error");
  useEffect(() => {
    if (oauthError) {
      const map: Record<string, string> = {
        oauth_state: t("auth.oauthStateError"),
        oauth_failed: t("auth.oauthFailedError"),
        oauth_conflict: t("auth.oauthConflictError"),
        oauth_token: t("auth.oauthTokenError"),
        wechat_oauth_failed: t("auth.wechatFailedError"),
        wechat_not_configured: t("auth.wechatNotConfiguredError"),
        google_not_configured: t("auth.googleNotConfiguredError"),
      };
      notify.error(map[oauthError] || t("auth.loginFailed"));
    }
  }, [oauthError, t]);

  function validate() {
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = t("auth.errEmailRequired");
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = t("auth.errEmailInvalid");
    if (!password) errs.password = t("auth.errPasswordRequired");
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await login(email, password);
      notify.success(t("auth.loginSuccess"));
      router.push(returnUrl);
    } catch (err) {
      notify.error(getErrorMessage(err, t("auth.loginFailed")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthSplitShell>
      <div className="surface-card p-8 shadow-[var(--shadow-float)]">
            <p className="page-eyebrow">{t("auth.accessEyebrow")}</p>
            <h2 className="page-heading">{t("auth.welcomeBack")}</h2>
            <p className="page-heading-desc">
              {t("auth.loginDesc")}
            </p>

            <div className="mt-6 flex border-b border-[var(--rule)]">
              <span className="flex-1 border-b-2 border-[var(--ink)] py-2.5 text-center font-[family-name:var(--font-mono)] text-[11px] font-semibold uppercase">
                {t("auth.login")}
              </span>
              <Link
                href="/signup"
                className="flex-1 py-2.5 text-center font-[family-name:var(--font-mono)] text-[11px] font-semibold uppercase text-[var(--text-muted)] hover:text-[var(--title)]"
              >
                {t("auth.register")}
              </Link>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <FormField id="login-email" label={t("auth.email")} error={errors.email}>
                <Input
                  name="email"
                  type="email"
                  autoComplete="email"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: "" })); }}
                  hasError={!!errors.email}
                  placeholder={t("auth.emailPlaceholder")}
                />
              </FormField>
              <FormField id="login-password" label={t("auth.password")} error={errors.password}>
                <PasswordInput
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: "" })); }}
                  hasError={!!errors.password}
                  placeholder={t("auth.passwordPlaceholder")}
                />
              </FormField>
              <div className="flex justify-end">
                <Link href="/forgot-password" className="text-sm text-[var(--primary)] hover:underline">
                  {t("auth.forgotPassword")}
                </Link>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--ink)] py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (<><ButtonSpinner /> {t("auth.loggingIn")}</>) : t("auth.loginShort")}
              </button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--divider)]" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-[var(--text-muted)]">{t("auth.or")}</span>
              </div>
            </div>

            <AuthOAuthButtons
              onWeChat={loginWithWeChat}
              onGoogle={loginWithGoogle}
              wechatLabelKey="auth.wechatScanLogin"
            />

            <p className="mt-6 text-center text-[12px] text-[var(--text-muted)]">
              {t("auth.noAccount")}{" "}
              <Link href="/signup" className="text-[var(--primary)] hover:underline font-medium">
                {t("auth.registerNow")}
              </Link>
            </p>
            <p className="mt-4 text-center text-[11px] text-[var(--text-muted)]">
              {t("auth.agreePrefix")}
              <Link href="/privacy" className="text-[var(--primary)] hover:underline">{t("auth.privacyPolicy")}</Link>
            </p>
      </div>
    </AuthSplitShell>
  );
}
