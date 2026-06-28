"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { authApi } from "@/lib/api-client";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import { FormField, ButtonSpinner } from "@/components/ui/form-field";
import { PasswordInput } from "@/components/ui/password-input";

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
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [remaining, setRemaining] = useState(0);

  const token = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("token") || ""
    : "";

  useEffect(() => {
    setRemaining(getRemainingSeconds());
    const t = setInterval(() => setRemaining((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  const rules = [
    { ok: password.length >= 6, label: "至少 6 个字符" },
    { ok: /[a-zA-Z]/.test(password) && /\d/.test(password), label: "包含字母和数字" },
    { ok: password === confirmPassword && !!confirmPassword, label: "两次输入一致" },
  ];

  function validate() {
    const errs: Record<string, string> = {};
    if (!password) errs.password = "请输入新密码";
    else if (password.length < 6) errs.password = "密码至少 6 个字符";
    if (password !== confirmPassword) errs.confirmPassword = "两次密码不一致";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    if (!token) {
      notify.error("无效的重置链接");
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
      notify.success("密码重置成功");
    } catch (err) {
      notify.error(getErrorMessage(err, "重置失败"));
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)] flex items-center justify-center px-4">
        <div className="surface-card max-w-md w-full p-10 text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-[var(--primary-soft)] flex items-center justify-center text-3xl mb-5">
            ✅
          </div>
          <h2 className="text-2xl font-semibold text-[var(--title)] mb-3">密码已重置</h2>
          <p className="text-sm text-[var(--text-muted)] mb-6">
            请使用新密码登录你的账户
          </p>
          <Link
            href="/login"
            className="inline-block gradient-btn px-6 py-3 text-sm font-medium"
          >
            去登录
          </Link>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)] flex items-center justify-center px-4">
        <div className="surface-card max-w-md w-full p-10 text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-[var(--coral)]/15 flex items-center justify-center text-3xl mb-5">
            ⚠️
          </div>
          <h2 className="text-2xl font-semibold text-[var(--title)] mb-3">链接无效</h2>
          <p className="text-sm text-[var(--text-muted)] mb-6">
            重置链接缺失或已过期。请重新申请。
          </p>
          <Link href="/forgot-password" className="inline-block gradient-btn px-6 py-3 text-sm font-medium">
            重新申请
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <span className="inline-block rounded-full bg-[var(--primary-soft)] px-3 py-1 text-xs font-medium text-[var(--primary)] mb-3">
            状态 1 · 密码重置
          </span>
          <h1 className="page-title">设置新密码</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            重置链接将在{" "}
            <span className={`font-mono font-semibold ${remaining < 300 ? "text-[var(--coral)]" : "text-[var(--title)]"}`}>
              {formatHMS(remaining)}
            </span>{" "}
            后失效
          </p>
        </div>

        <div className="surface-card p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <FormField id="reset-password" label="新密码" error={errors.password}>
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
                placeholder="至少 6 个字符"
              />
            </FormField>
            <FormField id="reset-confirm" label="确认新密码" error={errors.confirmPassword}>
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
                placeholder="再次输入新密码"
              />
            </FormField>

            <div className="rounded-lg bg-[var(--bg-subtle)] border border-[var(--divider)] p-3">
              <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">密码要求</p>
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
                取消
              </Link>
              <button
                type="submit"
                disabled={loading || !rules.every((r) => r.ok)}
                className="flex-1 gradient-btn py-2.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {loading ? (<><ButtonSpinner /> 重置中…</>) : "重置密码"}
              </button>
            </div>
          </form>

          <div className="mt-5 text-center text-sm">
            <Link href="/login" className="text-[var(--primary)] hover:underline">
              ← 返回登录页
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
