"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { AuthBrandPanel } from "@/components/auth-brand-panel";

export default function SignupPage() {
  const { register, loginWithGoogle, user } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) router.push("/dashboard");
  }, [user, router]);

  function validate() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "请输入姓名";
    if (!email.trim()) errs.email = "请输入邮箱";
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = "邮箱格式不正确";
    if (!password) errs.password = "请输入密码";
    else if (password.length < 6) errs.password = "密码至少6个字符";
    if (password !== confirmPassword) errs.confirmPassword = "两次密码不一致";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await register(name, email, password);
      setSuccess(true);
      toast.success("注册成功，请查收验证邮件");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "注册失败");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-[var(--bg-canvas)] p-6">
        <div className="surface-card p-10 text-center max-w-md w-full rounded-[14px]">
          <div className="mx-auto h-16 w-16 rounded-full bg-[var(--primary-soft)] flex items-center justify-center text-3xl mb-5">
            ✉️
          </div>
          <h2 className="text-2xl font-semibold text-[var(--title)] mb-3">注册成功</h2>
          <p className="text-sm text-[var(--text-muted)] mb-2">
            验证邮件已发送到 <strong className="text-[var(--title)]">{email}</strong>
          </p>
          <p className="text-sm text-[var(--text-muted)] mb-6">
            请查收邮件并点击验证链接完成注册
          </p>
          <Link href="/login" className="inline-block rounded-lg gradient-btn px-6 py-3 text-sm font-medium">
            去登录
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
          <div className="surface-card p-8 rounded-[14px]">
            <h2 className="text-2xl font-semibold text-[var(--title)]">创建账户</h2>
            <p className="mt-2 text-[13px] text-[var(--text-secondary)]">
              加入万叶，发现、Fork 和协作 AI Agent 想法
            </p>

            <div className="mt-6 flex rounded-lg bg-[var(--bg-subtle)] p-1">
              <Link
                href="/login"
                className="flex-1 rounded-md py-2 text-sm font-medium text-center text-[var(--text-muted)] hover:text-[var(--title)]"
              >
                登录
              </Link>
              <span className="flex-1 rounded-md py-2 text-sm font-medium text-center bg-white text-[var(--title)] shadow-sm">
                注册
              </span>
            </div>

            <button
              type="button"
              onClick={loginWithGoogle}
              className="mt-6 w-full flex items-center justify-center gap-2 rounded-lg border border-[var(--divider)] bg-white px-4 py-2.5 text-sm font-medium hover:bg-[var(--bg-subtle)]"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              使用 Google 账号继续
            </button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--divider)]" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-[var(--text-muted)]">或</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="signup-name" className="block text-sm font-medium text-[var(--title)] mb-1.5">姓名</label>
                <input
                  id="signup-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: "" })); }}
                  className={`w-full rounded-lg border bg-white px-4 py-2.5 text-sm outline-none ${
                    errors.name ? "border-[var(--coral)]" : "border-[var(--divider)] focus:border-[var(--primary)]"
                  }`}
                  placeholder="你的名字"
                />
                {errors.name && <p className="mt-1 text-xs text-[var(--coral)]">{errors.name}</p>}
              </div>
              <div>
                <label htmlFor="signup-email" className="block text-sm font-medium text-[var(--title)] mb-1.5">邮箱</label>
                <input
                  id="signup-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: "" })); }}
                  className={`w-full rounded-lg border bg-white px-4 py-2.5 text-sm outline-none ${
                    errors.email ? "border-[var(--coral)]" : "border-[var(--divider)] focus:border-[var(--primary)]"
                  }`}
                  placeholder="your@email.com"
                />
                {errors.email && <p className="mt-1 text-xs text-[var(--coral)]">{errors.email}</p>}
              </div>
              <div>
                <label htmlFor="signup-password" className="block text-sm font-medium text-[var(--title)] mb-1.5">密码</label>
                <input
                  id="signup-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: "" })); }}
                  className={`w-full rounded-lg border bg-white px-4 py-2.5 text-sm outline-none ${
                    errors.password ? "border-[var(--coral)]" : "border-[var(--divider)] focus:border-[var(--primary)]"
                  }`}
                  placeholder="至少6个字符"
                />
                {errors.password && <p className="mt-1 text-xs text-[var(--coral)]">{errors.password}</p>}
              </div>
              <div>
                <label htmlFor="signup-confirm" className="block text-sm font-medium text-[var(--title)] mb-1.5">确认密码</label>
                <input
                  id="signup-confirm"
                  name="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setErrors((p) => ({ ...p, confirmPassword: "" })); }}
                  className={`w-full rounded-lg border bg-white px-4 py-2.5 text-sm outline-none ${
                    errors.confirmPassword ? "border-[var(--coral)]" : "border-[var(--divider)] focus:border-[var(--primary)]"
                  }`}
                  placeholder="再次输入密码"
                />
                {errors.confirmPassword && <p className="mt-1 text-xs text-[var(--coral)]">{errors.confirmPassword}</p>}
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg gradient-btn py-2.5 text-sm font-medium disabled:opacity-50"
              >
                {loading ? "注册中…" : "注册"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
              已有账户？{" "}
              <Link href="/login" className="text-[var(--primary)] hover:underline font-medium">登录</Link>
            </p>
            <p className="mt-4 text-center text-[11px] text-[var(--text-muted)]">
              继续即表示同意《用户协议》和《隐私政策》
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
