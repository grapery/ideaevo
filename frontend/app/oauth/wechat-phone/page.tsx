"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n/provider";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import { AuthBrandPanel } from "@/components/auth-brand-panel";
import { FormField, ButtonSpinner } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

export default function WeChatPhonePage() {
  const { t } = useI18n();
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [sessionOk, setSessionOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (user?.phone_verified) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  useEffect(() => {
    authApi
      .phoneSession()
      .then(() => setSessionOk(true))
      .catch(() => setSessionOk(false));
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const sendCode = useCallback(async () => {
    const trimmed = phone.trim();
    if (!trimmed) {
      setErrors((p) => ({ ...p, phone: t("auth.errPhoneRequired") }));
      return;
    }
    setErrors((p) => ({ ...p, phone: "" }));
    setSending(true);
    try {
      await authApi.sendPhoneCode(trimmed);
      notify.success(t("auth.codeSent"));
      setCooldown(60);
    } catch (err) {
      const msg = getErrorMessage(err, t("auth.sendFailed"));
      setErrors((p) => ({ ...p, phone: msg }));
    } finally {
      setSending(false);
    }
  }, [phone, t]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = phone.trim();
    const errs: Record<string, string> = {};
    if (!trimmed) errs.phone = t("auth.errPhoneRequired");
    if (!code.trim()) errs.code = t("auth.errPhoneRequired");
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setVerifying(true);
    try {
      await authApi.verifyPhone(trimmed, code.trim());
      await refreshUser();
      notify.success(t("auth.phoneVerified"));
      router.push("/dashboard");
    } catch (err) {
      setErrors({ code: getErrorMessage(err, t("auth.phoneVerifyFailed")) });
    } finally {
      setVerifying(false);
    }
  }

  if (sessionOk === null) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-[var(--bg-canvas)]">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (sessionOk === false) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-[var(--bg-canvas)] p-6">
        <div className="surface-card max-w-md w-full p-10 text-center">
          <h2 className="heading-serif text-xl mb-3">{t("auth.sessionExpired")}</h2>
          <p className="text-sm text-[var(--text-muted)] mb-6">
            {t("auth.sessionExpiredHint")}
          </p>
          <Link href="/login" className="inline-block btn-outline px-6 py-2.5 text-sm font-medium">
            {t("auth.back")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex">
      <AuthBrandPanel />

      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-[var(--bg-canvas)]">
        <div className="w-full max-w-[400px]">
          <div className="surface-card p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#07C160]/15 text-[#07C160] text-xl">
                {t("auth.wechat")}
              </div>
              <div>
                <h2 className="heading-serif text-xl">{t("auth.bindPhoneTitle")}</h2>
                <p className="text-xs text-[var(--text-muted)]">{t("auth.bindPhoneDesc")}</p>
              </div>
            </div>

            <form onSubmit={handleVerify} className="space-y-4">
              <FormField id="wx-phone" label={t("auth.phone")} error={errors.phone}>
                <Input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setErrors((p) => ({ ...p, phone: "" })); }}
                  hasError={!!errors.phone}
                  placeholder={t("auth.phonePlaceholder")}
                />
              </FormField>
              <FormField id="wx-code" label={t("auth.smsCode")} error={errors.code}>
                <Input
                  name="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => { setCode(e.target.value); setErrors((p) => ({ ...p, code: "" })); }}
                  hasError={!!errors.code}
                  placeholder={t("auth.smsPlaceholder")}
                />
              </FormField>
              <button
                type="button"
                onClick={sendCode}
                disabled={sending || cooldown > 0}
                className="w-full btn-default py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cooldown > 0 ? t("auth.codeCooldown", { count: cooldown }) : sending ? t("auth.sendingCode") : t("auth.getCode")}
              </button>
              <button
                type="submit"
                disabled={verifying}
                className="w-full btn-outline py-2.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {verifying ? (<><ButtonSpinner /> {t("auth.verifyingPhone")}</>) : t("auth.verifyAndLogin")}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
              <Link href="/login" className="text-[var(--primary)] hover:underline">
                {t("auth.back")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
