"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import { AuthBrandPanel } from "@/components/auth-brand-panel";
import { FormField, ButtonSpinner } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

export default function WeChatPhonePage() {
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
      router.push("/dashboard");
    } catch (err) {
      setErrors({ code: getErrorMessage(err, "验证失败") });
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
          <h2 className="heading-serif text-xl mb-3">验证会话已过期</h2>
          <p className="text-sm text-[var(--text-muted)] mb-6">
            请重新使用微信扫码登录，完成后再绑定手机号。
          </p>
          <Link href="/login" className="inline-block btn-outline px-6 py-2.5 text-sm font-medium">
            返回登录
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
                微
              </div>
              <div>
                <h2 className="heading-serif text-xl">绑定手机号</h2>
                <p className="text-xs text-[var(--text-muted)]">微信登录需验证手机号后方可使用</p>
              </div>
            </div>

            <form onSubmit={handleVerify} className="space-y-4">
              <FormField id="wx-phone" label="手机号" error={errors.phone}>
                <Input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setErrors((p) => ({ ...p, phone: "" })); }}
                  hasError={!!errors.phone}
                  placeholder="13800138000"
                />
              </FormField>
              <FormField id="wx-code" label="验证码" error={errors.code}>
                <Input
                  name="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => { setCode(e.target.value); setErrors((p) => ({ ...p, code: "" })); }}
                  hasError={!!errors.code}
                  placeholder="6 位数字"
                />
              </FormField>
              <button
                type="button"
                onClick={sendCode}
                disabled={sending || cooldown > 0}
                className="w-full btn-default py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cooldown > 0 ? `${cooldown}s 后可重新获取` : sending ? "发送中…" : "获取验证码"}
              </button>
              <button
                type="submit"
                disabled={verifying}
                className="w-full btn-outline py-2.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {verifying ? (<><ButtonSpinner /> 验证中…</>) : "完成验证并登录"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
              <Link href="/login" className="text-[var(--primary)] hover:underline">
                返回登录
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
