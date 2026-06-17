"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authApi } from "@/lib/api-client";

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setStatus("error");
      setMessage("缺少验证 token，请检查邮件中的链接是否完整");
      return;
    }
    authApi
      .verifyEmail(token)
      .then(() => {
        setStatus("success");
        setMessage("邮箱验证成功！你现在可以登录了");
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "验证失败，链接可能已过期");
      });
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="surface-card p-10 text-center">
          {status === "loading" && (
            <>
              <div className="mx-auto h-16 w-16 rounded-full bg-[var(--primary-soft)] flex items-center justify-center mb-5">
                <svg className="h-8 w-8 animate-spin text-[var(--primary)]" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-[var(--title)] mb-3">验证中…</h2>
              <p className="text-sm text-[var(--text-muted)]">正在验证你的邮箱地址</p>
            </>
          )}
          {status === "success" && (
            <>
              <div className="mx-auto h-16 w-16 rounded-full bg-[var(--teal-soft)] flex items-center justify-center text-3xl mb-5">
                ✅
              </div>
              <h2 className="text-2xl font-semibold text-[var(--title)] mb-3">验证成功</h2>
              <p className="text-sm text-[var(--text-muted)] mb-6">{message}</p>
              <Link
                href="/login"
                className="inline-block rounded-lg gradient-btn px-6 py-3 text-sm font-medium transition-colors"
              >
                去登录
              </Link>
            </>
          )}
          {status === "error" && (
            <>
              <div className="mx-auto h-16 w-16 rounded-full bg-[var(--coral)]/15 flex items-center justify-center text-3xl mb-5">
                ❌
              </div>
              <h2 className="text-2xl font-semibold text-[var(--title)] mb-3">验证失败</h2>
              <p className="text-sm text-[var(--text-muted)] mb-6">{message}</p>
              <div className="flex gap-3 justify-center">
                <Link
                  href="/login"
                  className="rounded-lg border border-[var(--divider)] px-5 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors"
                >
                  返回登录
                </Link>
                <Link
                  href="/signup"
                  className="rounded-lg gradient-btn px-5 py-2.5 text-sm font-medium"
                >
                  重新注册
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
