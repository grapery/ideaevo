"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n/provider";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import { AuthBrandPanel } from "@/components/auth-brand-panel";
import { AuthOAuthButtons } from "@/components/auth-oauth-buttons";
import { FormField, ButtonSpinner } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { DeimosIcon } from "@/components/deimos-icon";

export default function SignupPage() {
  const { t } = useI18n();
  const { register, loginWithGoogle, loginWithWeChat, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 仅接受站内相对路径，防止开放跳转
  const rawReturnUrl = searchParams.get("returnUrl");
  const returnUrl = rawReturnUrl && /^\/(?!\/)/.test(rawReturnUrl) ? rawReturnUrl : "/dashboard";

  useEffect(() => {
    if (user) router.push(returnUrl);
  }, [user, router, returnUrl]);

  function validate() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = t("auth.errNameRequired");
    if (!email.trim()) errs.email = t("auth.errEmailRequired");
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = t("auth.errEmailInvalid");
    if (!password) errs.password = t("auth.errPasswordRequired");
    else if (password.length < 6) errs.password = t("auth.errPasswordShort");
    if (password !== confirmPassword) errs.confirmPassword = t("auth.errPasswordMismatch");
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await register(name, email, password);
      setSuccess(true);
      notify.success(t("auth.registerSuccess"));
    } catch (err) {
      notify.error(getErrorMessage(err, t("auth.registerFailed")));
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="page-shell flex items-center justify-center p-6">
        <div className="w-full max-w-md surface-card p-10 text-center shadow-[0_18px_50px_rgba(20,24,32,.07)]">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-md bg-[var(--ink)] text-white">
            <DeimosIcon name="send" className="h-6 w-6" />
          </div>
          <h2 className="heading-serif text-2xl mb-3">{t("auth.registerSuccess")}</h2>
          <p className="text-sm text-[var(--text-muted)] mb-2">
            {t("auth.verifyEmailSent")} <strong className="text-[var(--title)]">{email}</strong>
          </p>
          <p className="text-sm text-[var(--text-muted)] mb-6">
            {t("auth.verifyEmailHint")}
          </p>
          <Link href="/login" className="inline-block btn-outline px-6 py-3 text-sm font-medium">
            {t("auth.goLogin")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell flex">
      <AuthBrandPanel />

      <div className="flex flex-1 items-center justify-center bg-[var(--bg-canvas)] p-6 sm:p-12">
        <div className="w-full max-w-[400px]">
          <div className="surface-card p-8 shadow-[0_18px_50px_rgba(20,24,32,.07)]">
            <p className="meta-label mb-3">{t("auth.createEyebrow")}</p>
            <h2 className="font-[family-name:var(--font-display)] text-[28px] font-semibold tracking-[-0.03em]">{t("auth.createAccount")}</h2>
            <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">
              {t("auth.joinDeimos")}
            </p>

            <div className="mt-6 flex border-b border-[var(--rule)]">
              <Link
                href="/login"
                className="flex-1 py-2.5 text-center font-[family-name:var(--font-mono)] text-[11px] font-semibold uppercase text-[var(--text-muted)] hover:text-[var(--title)]"
              >
                {t("auth.login")}
              </Link>
              <span className="flex-1 border-b-2 border-[var(--ink)] py-2.5 text-center font-[family-name:var(--font-mono)] text-[11px] font-semibold uppercase">
                {t("auth.register")}
              </span>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <FormField id="signup-name" label={t("auth.name")} error={errors.name}>
                <Input
                  name="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: "" })); }}
                  hasError={!!errors.name}
                  placeholder={t("auth.namePlaceholder")}
                />
              </FormField>
              <FormField id="signup-email" label={t("auth.email")} error={errors.email}>
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
              <FormField id="signup-password" label={t("auth.password")} error={errors.password} hint={t("auth.passwordMinHint")}>
                <PasswordInput
                  name="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: "" })); }}
                  hasError={!!errors.password}
                  placeholder={t("auth.newPasswordPlaceholder")}
                />
              </FormField>
              <FormField id="signup-confirm" label={t("auth.confirmPassword")} error={errors.confirmPassword}>
                <PasswordInput
                  name="confirm-password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setErrors((p) => ({ ...p, confirmPassword: "" })); }}
                  hasError={!!errors.confirmPassword}
                  placeholder={t("auth.confirmPasswordPlaceholder")}
                />
              </FormField>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--ink)] py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (<><ButtonSpinner /> {t("auth.registering")}</>) : t("auth.registerShort")}
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
              wechatLabelKey="auth.wechatScanRegister"
            />

            <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
              {t("auth.haveAccount")}{" "}
              <Link href="/login" className="text-[var(--primary)] hover:underline font-medium">{t("auth.login")}</Link>
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
