"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { authApi } from "@/lib/api-client";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import { useI18n } from "@/lib/i18n/provider";
import { FormField, ButtonSpinner } from "@/components/ui/form-field";
import { PasswordInput } from "@/components/ui/password-input";
import { DeimosIcon } from "@/components/deimos-icon";

function getRemainingSeconds(): number {
  if (typeof window === "undefined") return 60 * 60;
  const issued = Number(new URLSearchParams(window.location.search).get("issued")) || Date.now();
  const elapsed = Math.floor((Date.now() - issued) / 1000);
  return Math.max(0, 60 * 60 - elapsed);
}

function formatHMS(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export default function ResetPasswordPage() {
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [remaining, setRemaining] = useState(getRemainingSeconds);

  const token = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("token") || ""
    : "";

  useEffect(() => {
    const timer = setInterval(() => setRemaining((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);

  const rules = [
    { ok: password.length >= 6, label: t("auth.reqMinLength") },
    { ok: /[a-zA-Z]/.test(password) && /\d/.test(password), label: t("auth.reqAlphanumeric") },
    { ok: password === confirmPassword && !!confirmPassword, label: t("auth.reqMatch") },
  ];

  function validate() {
    const errs: Record<string, string> = {};
    if (!password) errs.password = t("auth.errPasswordRequired");
    else if (password.length < 6) errs.password = t("auth.errPasswordShort");
    if (password !== confirmPassword) errs.confirmPassword = t("auth.errPasswordMismatch");
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    if (!token) {
      notify.error(t("auth.invalidLink"));
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
      notify.success(t("auth.resetSuccess"));
    } catch (err) {
      notify.error(getErrorMessage(err, t("common.operationFailed")));
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="page-shell flex items-center justify-center px-4">
        <div className="w-full max-w-md surface-card p-10 text-center">
          <p className="meta-label mb-5">{t("auth.recoveryComplete")}</p>
          <div className="mx-auto h-14 w-14 rounded-md border border-[var(--accent-success)]/30 bg-[var(--accent-success-soft)] flex items-center justify-center text-[var(--accent-success)] mb-5">
            <DeimosIcon name="check" className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-semibold text-[var(--title)] mb-3">{t("auth.resetSuccess")}</h2>
          <p className="text-sm text-[var(--text-muted)] mb-6">
            {t("auth.resetSuccessHint")}
          </p>
          <Link
            href="/login"
            className="inline-block btn-outline px-6 py-3 text-sm font-medium"
          >
            {t("auth.goLogin")}
          </Link>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="page-shell flex items-center justify-center px-4">
        <div className="w-full max-w-md surface-card p-10 text-center">
          <p className="meta-label mb-5">{t("auth.recoveryInvalid")}</p>
          <div className="mx-auto h-14 w-14 rounded-md border border-[var(--accent-warning)]/30 bg-[var(--accent-warning-soft)] flex items-center justify-center text-[var(--accent-warning)] mb-5">
            <DeimosIcon name="decision" className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-semibold text-[var(--title)] mb-3">{t("auth.invalidLink")}</h2>
          <p className="text-sm text-[var(--text-muted)] mb-6">
            {t("auth.invalidLinkHint")}
          </p>
          <Link href="/forgot-password" className="inline-block btn-outline px-6 py-3 text-sm font-medium">
            {t("auth.reapply")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <p className="meta-label mb-3">{t("auth.recoveryReset")}</p>
          <h1 className="page-heading">{t("auth.resetTitle")}</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {t("auth.resetDesc", { expires: formatHMS(remaining) })}
          </p>
        </div>

        <div className="surface-card p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <FormField id="reset-password" label={t("auth.newPassword")} error={errors.password}>
              <PasswordInput
                name="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrors((p) => ({ ...p, password: "" }));
                }}
                hasError={!!errors.password}
                required
                minLength={6}
                placeholder={t("auth.newPasswordPlaceholder")}
              />
            </FormField>
            <FormField id="reset-confirm" label={t("auth.confirmNewPassword")} error={errors.confirmPassword}>
              <PasswordInput
                name="confirm-password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setErrors((p) => ({ ...p, confirmPassword: "" }));
                }}
                hasError={!!errors.confirmPassword}
                required
                minLength={6}
                placeholder={t("auth.confirmPasswordPlaceholder")}
              />
            </FormField>

            <div className="rounded-lg bg-[var(--bg-subtle)] border border-[var(--divider)] p-3">
              <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">{t("auth.passwordRequirements")}</p>
              <ul className="space-y-1.5">
                {rules.map((r) => (
                  <li key={r.label} className="flex items-center gap-2 text-xs">
                    <span className={r.ok ? "text-[var(--teal)]" : "text-[var(--text-muted)]"}>
                      {r.ok ? "✓" : "○"}
                    </span>
                    <span className={r.ok ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]"}>
                      {r.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex gap-3">
              <Link
                href="/login"
                className="flex-1 btn-default py-2.5 text-center"
              >
                {t("common.cancel")}
              </Link>
              <button
                type="submit"
                disabled={loading || !rules.every((r) => r.ok)}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-[var(--ink)] py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (<><ButtonSpinner /> {t("auth.resetting")}</>) : t("auth.resetPassword")}
              </button>
            </div>
          </form>

          <div className="mt-5 text-center text-sm">
            <Link href="/login" className="text-[var(--primary)] hover:underline">
              {t("auth.backToLogin")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
