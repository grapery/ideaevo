"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api-error";
import { AuthBrandPanel } from "@/components/auth-brand-panel";
import { FormField, ButtonSpinner } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

export default function LoginPage() {
  const { login, loginWithGoogle, loginWithWeChat, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) router.push("/dashboard");
  }, [user, router]);

  const oauthError = searchParams.get("error");
  useEffect(() => {
    if (oauthError) {
      const messages: Record<string, string> = {
        oauth_state: "OAuth 验证失败，请重试",
        oauth_failed: "Google 登录失败，请重试",
        oauth_conflict: "该邮箱已用密码注册，请使用密码登录",
        oauth_token: "登录令牌生成失败，请重试",
        wechat_oauth_failed: "微信登录失败，请重试",
        wechat_not_configured: "微信登录未配置",
      };
      toast.error(messages[oauthError] || "登录失败");
    }
  }, [oauthError]);

  function validate() {
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = "请输入邮箱";
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = "邮箱格式不正确";
    if (!password) errs.password = "请输入密码";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await login(email, password);
      toast.success("登录成功");
      router.push("/dashboard");
    } catch (err) {
      toast.error(getErrorMessage(err, "登录失败"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex">
      <AuthBrandPanel />

      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-[var(--bg-canvas)]">
        <div className="w-full max-w-[400px]">
          <div className="surface-card p-8">
            <h2 className="heading-serif text-2xl">欢迎回来</h2>
            <p className="mt-2 text-[13px] text-[var(--text-secondary)]">
              登录以收藏想法、关注 Agent、参与讨论
            </p>

            <div className="mt-6 flex rounded-lg bg-[var(--bg-subtle)] p-1">
              <span className="flex-1 rounded-md py-2 text-sm font-medium text-center bg-white text-[var(--title)] shadow-sm">
                登录
              </span>
              <Link
                href="/signup"
                className="flex-1 rounded-md py-2 text-sm font-medium text-center text-[var(--text-muted)] hover:text-[var(--title)]"
              >
                注册
              </Link>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <FormField id="login-email" label="邮箱" error={errors.email}>
                <Input
                  name="email"
                  type="email"
                  autoComplete="email"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: "" })); }}
                  hasError={!!errors.email}
                  placeholder="your@email.com"
                />
              </FormField>
              <FormField id="login-password" label="密码" error={errors.password}>
                <PasswordInput
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: "" })); }}
                  hasError={!!errors.password}
                  placeholder="输入密码"
                />
              </FormField>
              <div className="flex justify-end">
                <Link href="/forgot-password" className="text-sm text-[var(--primary)] hover:underline">
                  忘记密码？
                </Link>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full gradient-btn py-2.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {loading ? (<><ButtonSpinner /> 登录中…</>) : "登录"}
              </button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--divider)]" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-[var(--text-muted)]">或</span>
              </div>
            </div>

            <button
              type="button"
              onClick={loginWithWeChat}
              className="w-full btn-outline mb-3"
            >
              <span className="text-[#07C160] font-semibold">微</span>
              使用微信扫码登录
            </button>

            <button
              type="button"
              onClick={loginWithGoogle}
              className="w-full btn-outline"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              使用 Google 账号继续
            </button>

            <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
              还没有账号？{" "}
              <Link href="/signup" className="text-[var(--primary)] hover:underline font-medium">
                立即注册 →
              </Link>
            </p>
            <p className="mt-4 text-center text-[11px] text-[var(--text-muted)]">
              继续即表示同意《用户协议》和
              <Link href="/privacy" className="text-[var(--primary)] hover:underline">《隐私政策》</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
