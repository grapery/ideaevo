"use client";

import { useState, useEffect, useCallback } from "react";
import { authApi } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
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
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const sendCode = useCallback(async () => {
    const trimmed = phone.trim();
    if (!trimmed) {
      setErrors((p) => ({ ...p, phone: "请输入手机号" }));
      return;
    }
    setErrors((p) => ({ ...p, phone: "" }));
    setSending(true);
    try {
      await authApi.sendPhoneCode(trimmed);
      notify.success("验证码已发送");
      setCooldown(60);
    } catch (err) {
      const msg = getErrorMessage(err, "发送失败");
      setErrors((p) => ({ ...p, phone: msg }));
    } finally {
      setSending(false);
    }
  }, [phone]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = phone.trim();
    const errs: Record<string, string> = {};
    if (!trimmed) errs.phone = "请输入手机号";
    if (!code.trim()) errs.code = "请输入验证码";
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setVerifying(true);
    try {
      await authApi.verifyPhone(trimmed, code.trim());
      await refreshUser();
      notify.success("手机验证成功");
      await onSuccess();
    } catch (err) {
      setErrors({ code: getErrorMessage(err, "验证失败") });
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
        <p className="text-sm text-[var(--text-muted)]">验证会话已过期，请重新使用微信扫码登录。</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#07C160]/15 text-[#07C160] text-xl">
          微
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--title)]">绑定手机号</p>
          <p className="text-xs text-[var(--text-muted)]">微信登录需验证手机号后方可使用</p>
        </div>
      </div>

      <form onSubmit={handleVerify} className="space-y-4">
        <FormField id="modal-wx-phone" label="手机号" error={errors.phone}>
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
            placeholder="13800138000"
          />
        </FormField>
        <FormField id="modal-wx-code" label="验证码" error={errors.code}>
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
            placeholder="6 位数字"
          />
        </FormField>
        <button
          type="button"
          onClick={sendCode}
          disabled={sending || cooldown > 0}
          className="w-full btn-default py-2.5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cooldown > 0 ? `${cooldown}s 后可重新获取` : sending ? "发送中…" : "获取验证码"}
        </button>
        <button
          type="submit"
          disabled={verifying}
          className="inline-flex w-full items-center justify-center gap-2 btn-outline py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
        >
          {verifying ? (
            <>
              <ButtonSpinner /> 验证中…
            </>
          ) : (
            "完成验证并登录"
          )}
        </button>
      </form>
    </div>
  );
}
