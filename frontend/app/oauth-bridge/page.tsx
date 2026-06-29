"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { OAUTH_MESSAGE_TYPE, type OAuthBridgeStatus, type OAuthProvider } from "@/lib/oauth";

function OAuthBridgeContent() {
  const searchParams = useSearchParams();
  const [done, setDone] = useState(false);

  const status = (searchParams.get("status") || "error") as OAuthBridgeStatus;
  const provider = (searchParams.get("provider") || "google") as OAuthProvider;
  const errorCode = searchParams.get("error_code") || undefined;

  useEffect(() => {
    if (done) return;

    const payload = {
      type: OAUTH_MESSAGE_TYPE,
      status,
      provider,
      ...(errorCode ? { errorCode } : {}),
    };

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(payload, window.location.origin);
    }

    setDone(true);

    const closeTimer = window.setTimeout(() => {
      window.close();
    }, 300);

    return () => window.clearTimeout(closeTimer);
  }, [done, status, provider, errorCode]);

  const label =
    status === "success"
      ? "登录成功，正在关闭…"
      : status === "pending"
        ? "请返回主页面完成手机验证…"
        : "登录未完成，正在关闭…";

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] flex items-center justify-center px-4">
      <div className="surface-card max-w-sm w-full p-8 text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
        <p className="text-sm text-[var(--text-secondary)]">{label}</p>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          若窗口未自动关闭，请手动关闭后返回原页面。
        </p>
      </div>
    </div>
  );
}

export default function OAuthBridgePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--bg-canvas)] flex items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
        </div>
      }
    >
      <OAuthBridgeContent />
    </Suspense>
  );
}
