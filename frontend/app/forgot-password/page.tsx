"use client";

import { useState } from "react";
import Link from "next/link";
import { authApi } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/api-error";
import { notify } from "@/components/ui/notify";
import { FormField, ButtonSpinner } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setError("请输入有效的邮箱地址");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch (err) {
      notify.error(getErrorMessage(err, "发送失败"));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)]">
        <div className="mx-auto max-w-lg px-4 py-16">
          <div className="surface-card p-10 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-[var(--primary-soft)] flex items-center justify-center text-3xl mb-5">
              ✉️
            </div>
            <h2 className="text-2xl font-semibold text-[var(--title)] mb-3">邮件已发送</h2>
            <p className="text-sm text-[var(--text-muted)] mb-6">
              如果该邮箱已注册，重置密码邮件已发送到 <strong className="text-[var(--text-secondary)]">{email}</strong>，请查收。
            </p>
            <Link
              href="/login"
              className="inline-block gradient-btn px-6 py-3 text-sm font-medium"
            >
              返回登录
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="text-center mb-8">
          <h1 className="page-title">忘记密码</h1>
          <p className="mt-3 text-base text-[var(--text-muted)]">
            输入注册邮箱，我们将发送重置链接
          </p>
        </div>

        <div className="surface-card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <FormField id="forgot-email" label="邮箱地址" error={error}>
              <Input
                name="email"
                type="email"
                autoComplete="email"
                spellCheck={false}
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                hasError={!!error}
                placeholder="your@email.com"
                required
              />
            </FormField>
            <button
              type="submit"
              disabled={loading}
              className="w-full gradient-btn py-3 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              {loading ? (<><ButtonSpinner /> 发送中…</>) : "发送重置链接"}
            </button>
          </form>
          <div className="mt-6 text-center text-sm text-[var(--text-muted)]">
            <Link href="/login" className="text-[var(--primary)] hover:underline font-medium">
              返回登录
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
