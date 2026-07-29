"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { authApi } from "@/lib/api-client";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
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
      <div className="min-h-[calc(100dvh-var(--header-height))] bg-[#f3f5f7] flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-lg border border-[var(--rule)] bg-white p-10 text-center">
          <p className="meta-label mb-5">AUTH RECOVERY / COMPLETE</p>
          <div className="mx-auto h-14 w-14 rounded-md border border-[var(--accent-success)]/30 bg-[var(--accent-success-soft)] flex items-center justify-center text-[var(--accent-success)] mb-5">
            <DeimosIcon name="check" className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-semibold text-[var(--title)] mb-3">密码已重置</h2>
          <p className="text-sm text-[var(--text-muted)] mb-6">
            请使用新密码登录你的账户
          </p>
          <Link
            href="/login"
            className="inline-block btn-outline px-6 py-3 text-sm font-medium"
          >
            去登录
          </Link>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-[calc(100dvh-var(--header-height))] bg-[#f3f5f7] flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-lg border border-[var(--rule)] bg-white p-10 text-center">
          <p className="meta-label mb-5">AUTH RECOVERY / INVALID TOKEN</p>
          <div className="mx-auto h-14 w-14 rounded-md border border-[var(--accent-warning)]/30 bg-[var(--accent-warning-soft)] flex items-center justify-center text-[var(--accent-warning)] mb-5">
            <DeimosIcon name="decision" className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-semibold text-[var(--title)] mb-3">链接无效</h2>
          <p className="text-sm text-[var(--text-muted)] mb-6">
            重置链接缺失或已过期。请重新申请。
          </p>
          <Link href="/forgot-password" className="inline-block btn-outline px-6 py-3 text-sm font-medium">
            重新申请
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-var(--header-height))] bg-[#f3f5f7] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <p className="meta-label mb-3">AUTH RECOVERY / RESET CREDENTIAL</p>
          <h1 className="page-title">设置新密码</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            重置链接将在{" "}
            <span className={`font-mono font-semibold ${remaining < 300 ? "text-[var(--coral)]" : "text-[var(--title)]"}`}>
              {formatHMS(remaining)}
            </span>{" "}
            后失效
          </p>
        </div>

        <div className="rounded-lg border border-[var(--rule)] bg-white p-6">
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
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-[var(--ink)] py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
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
