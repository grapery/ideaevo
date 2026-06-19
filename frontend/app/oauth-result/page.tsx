"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function OAuthResultPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [remaining, setRemaining] = useState(3);

  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const email = params?.get("email") || user?.email || "";
  const error = params?.get("error");

  useEffect(() => {
    if (error) return;
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(t);
          router.push("/");
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [router, error]);

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)] flex items-center justify-center px-4">
        <div className="surface-card max-w-md w-full p-10 text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-[var(--coral)]/15 flex items-center justify-center text-3xl mb-5">
            ⚠️
          </div>
          <h2 className="text-2xl font-semibold text-[var(--title)] mb-3">OAuth 绑定失败</h2>
          <p className="text-sm text-[var(--text-muted)] mb-6">{error}</p>
          <Link href="/login" className="inline-block gradient-btn px-6 py-3 text-sm font-medium">
            返回登录
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-4">
          <span className="inline-block rounded-full bg-[var(--primary-soft)] px-3 py-1 text-xs font-medium text-[var(--primary)]">
            状态 2 · OAuth 绑定成功
          </span>
        </div>
        <div className="surface-card p-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-white border border-[var(--divider)] shadow-sm">
            {/* Google "G" */}
            <svg className="h-8 w-8" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.12 15.89-5.78l-7.73-6c-2.16 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-[var(--title)] mb-2">Google 账号已绑定</h1>
          <p className="text-sm text-[var(--text-muted)] mb-5">
            你的 Google 账号已成功绑定到万叶。以后可使用 Google 一键登录。
          </p>

          <ul className="text-left space-y-2.5 mb-6">
            {[
              email ? `邮箱 ${email} 已验证` : "邮箱已验证",
              user ? `已与本地账号 ${user.name} 关联` : "已与本地账号关联",
              "头像与个人资料已同步",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                <span className="text-[var(--teal)] mt-0.5">✓</span>
                {line}
              </li>
            ))}
          </ul>

          <Link href="/" className="inline-block gradient-btn px-6 py-2.5 text-sm font-medium">
            进入万叶
          </Link>
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            {remaining} 秒后自动跳转…
          </p>
        </div>
      </div>
    </div>
  );
}
