"use client";

import { useState, useEffect, useCallback } from "react";
import { authApi } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n/provider";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import { FormField, ButtonSpinner } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

type AuthModalWeChatPhoneProps = {
  onSuccess: () => void | Promise<void>;
  onSessionExpired: () => void;
};

export function AuthModalWeChatPhone({
  onSuccess,
  onSessionExpired,
}: AuthModalWeChatPhoneProps) {
  const { t } = useI18n();
  const { refreshUser } = useAuth();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [sessionOk, setSessionOk] = useState<boolean | null>(null);

  useEffect(() => {
    authApi
      .phoneSession()
      .then(() => setSessionOk(true))
      .catch(() => setSessionOk(false));
  }, []);

  useEffect(() => {
    if (sessionOk === false) {
      onSessionExpired();
    }
  }, [sessionOk, onSessionExpired]);

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
      await onSuccess();
    } catch (err) {
      setErrors({ code: getErrorMessage(err, t("auth.phoneVerifyFailed")) });
    } finally {
      setVerifying(false);
    }
  }

  if (sessionOk === null) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  if (sessionOk === false) {
    return (
      <div className="py-4 text-center">
        <p className="text-sm text-[var(--text-muted)]">{t("auth.sessionExpiredHint")}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#07C160]/15 text-[#07C160] text-xl">
          {t("auth.wechat")}
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--title)]">{t("auth.bindPhoneTitle")}</p>
          <p className="text-xs text-[var(--text-muted)]">{t("auth.bindPhoneDesc")}</p>
        </div>
      </div>

      <form onSubmit={handleVerify} className="space-y-4">
        <FormField id="modal-wx-phone" label={t("auth.phone")} error={errors.phone}>
          <Input
            name="phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setErrors((p) => ({ ...p, phone: "" }));
            }}
            hasError={!!errors.phone}
            placeholder={t("auth.phonePlaceholder")}
          />
        </FormField>
        <FormField id="modal-wx-code" label={t("auth.smsCode")} error={errors.code}>
          <Input
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setErrors((p) => ({ ...p, code: "" }));
            }}
            hasError={!!errors.code}
            placeholder={t("auth.smsPlaceholder")}
          />
        </FormField>
        <button
          type="button"
          onClick={sendCode}
          disabled={sending || cooldown > 0}
          className="w-full btn-default py-2.5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cooldown > 0 ? t("auth.codeCooldown", { count: cooldown }) : sending ? t("auth.sendingCode") : t("auth.getCode")}
        </button>
        <button
          type="submit"
          disabled={verifying}
          className="inline-flex w-full items-center justify-center gap-2 btn-outline py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
        >
          {verifying ? (
            <>
              <ButtonSpinner /> {t("auth.verifyingPhone")}
            </>
          ) : (
            t("auth.verifyAndLogin")
          )}
        </button>
      </form>
    </div>
  );
}
