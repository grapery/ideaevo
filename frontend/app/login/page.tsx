"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n/provider";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import { AuthBrandPanel } from "@/components/auth-brand-panel";
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

  useEffect(() => {
    if (user) router.push("/dashboard");
  }, [user, router]);

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
      router.push("/dashboard");
    } catch (err) {
      notify.error(getErrorMessage(err, t("auth.loginFailed")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100dvh-var(--header-height))] flex">
      <AuthBrandPanel />

      <div className="flex flex-1 items-center justify-center bg-[#f3f5f7] p-6 sm:p-12">
        <div className="w-full max-w-[400px]">
          <div className="rounded-lg border border-[var(--rule)] bg-white p-8 shadow-[0_18px_50px_rgba(20,24,32,.07)]">
            <p className="meta-label mb-3">ACCESS / DEIMOS</p>
            <h2 className="font-[family-name:var(--font-display)] text-[28px] font-semibold tracking-[-0.03em]">{t("auth.welcomeBack")}</h2>
            <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">
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

            <button
              type="button"
              onClick={loginWithWeChat}
              className="w-full btn-outline mb-3"
            >
              <span className="text-[#07C160] font-semibold">{t("auth.wechat")}</span>
              {t("auth.wechatScanLogin")}
            </button>

            <button
              type="button"
              onClick={loginWithGoogle}
              className="w-full btn-outline"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              {t("auth.googleContinue")}
            </button>

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
        </div>
      </div>
    </div>
  );
}
