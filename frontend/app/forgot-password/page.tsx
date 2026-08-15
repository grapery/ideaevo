"use client";

import { useState } from "react";
import Link from "next/link";
import { authApi } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/api-error";
import { useI18n } from "@/lib/i18n/provider";
import { notify } from "@/components/ui/notify";
import { FormField, ButtonSpinner } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { DeimosIcon } from "@/components/deimos-icon";
import { AuthSplitShell } from "@/components/auth-split-shell";

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setError(t("auth.errEmailInvalid"));
      return;
    }
    setError("");
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch (err) {
      notify.error(getErrorMessage(err, t("auth.sendFailed")));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <AuthSplitShell>
        <div className="surface-card p-8 text-center shadow-[0_18px_50px_rgba(20,24,32,.07)]">
          <p className="meta-label mb-5">{t("auth.recoverySent")}</p>
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-md bg-[var(--ink)] text-white">
            <DeimosIcon name="send" className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-semibold text-[var(--title)] mb-3">{t("auth.emailSent")}</h2>
          <p className="text-sm text-[var(--text-muted)] mb-6">
            {t("auth.emailSentHint")} <strong className="text-[var(--text-secondary)]">{email}</strong>
          </p>
          <Link
            href="/login"
            className="inline-block btn-outline px-6 py-3 text-sm font-medium"
          >
            {t("auth.backToLogin")}
          </Link>
        </div>
      </AuthSplitShell>
    );
  }

  return (
    <AuthSplitShell>
      <div className="surface-card p-8 shadow-[0_18px_50px_rgba(20,24,32,.07)]">
        <p className="meta-label mb-3">{t("auth.recoveryRequest")}</p>
        <h1 className="font-[family-name:var(--font-display)] text-[28px] font-semibold tracking-[-0.03em]">
          {t("auth.forgotTitle")}
        </h1>
        <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">
          {t("auth.forgotDesc")}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <FormField id="forgot-email" label={t("auth.emailAddress")} error={error}>
            <Input
              name="email"
              type="email"
              autoComplete="email"
              spellCheck={false}
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              hasError={!!error}
              placeholder={t("auth.emailPlaceholder")}
              required
            />
          </FormField>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--ink)] py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 transition-transform active:scale-[0.97]"
          >
            {loading ? (<><ButtonSpinner /> {t("auth.sending")}</>) : t("auth.sendResetLink")}
          </button>
        </form>
        <div className="mt-6 text-center text-sm text-[var(--text-muted)]">
          <Link href="/login" className="text-[var(--primary)] hover:underline font-medium">
            {t("auth.backToLogin")}
          </Link>
        </div>
      </div>
    </AuthSplitShell>
  );
}
