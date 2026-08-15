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
      <div className="page-shell">
        <div className="mx-auto max-w-lg px-4 py-16">
          <div className="surface-card p-10 text-center">
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
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="mb-8 text-center">
          <p className="meta-label mb-3">{t("auth.recoveryRequest")}</p>
          <h1 className="page-heading">{t("auth.forgotTitle")}</h1>
          <p className="mt-3 text-base text-[var(--text-muted)]">
            {t("auth.forgotDesc")}
          </p>
        </div>

        <div className="surface-card p-8 shadow-[var(--shadow-float)]">
          <form onSubmit={handleSubmit} className="space-y-5">
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
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--ink)] py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
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
      </div>
    </div>
  );
}
