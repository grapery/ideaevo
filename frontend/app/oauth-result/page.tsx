"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n/provider";
import { DeimosIcon } from "@/components/deimos-icon";

export default function OAuthResultPage() {
  const router = useRouter();
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [remaining, setRemaining] = useState(3);

  const provider = searchParams.get("provider") || "google";
  const email = searchParams.get("email") || user?.email || "";
  const error = searchParams.get("error");

  const isWeChat = provider === "wechat";

  useEffect(() => {
    if (error) return;
    const timer = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(timer);
          router.push("/");
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [router, error]);

  if (error) {
    return (
      <div className="page-shell-full flex items-center justify-center px-4">
        <div className="surface-card max-w-md w-full p-10 text-center">
          <div className="mx-auto h-14 w-14 rounded-md border border-[var(--accent-warning)]/30 bg-[var(--accent-warning-soft)] flex items-center justify-center text-[var(--accent-warning)] mb-5">
            <DeimosIcon name="decision" className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-semibold text-[var(--title)] mb-3">{t("auth.loginFailed")}</h2>
          <p className="text-sm text-[var(--text-muted)] mb-6">{error}</p>
          <Link href="/login" className="inline-block btn-outline px-6 py-3 text-sm font-medium">
            {t("auth.backToLogin")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell-full flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-4">
          <span className="inline-block rounded-full bg-[var(--primary-soft)] px-3 py-1 text-xs font-medium text-[var(--primary)]">
            {isWeChat ? t("auth.wechatLoginSuccess") : t("auth.googleBound")}
          </span>
        </div>
        <div className="surface-card p-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-white border border-[var(--divider)] shadow-sm text-2xl">
            {isWeChat ? (
              <span className="text-[#07C160] font-bold">{t("auth.wechat")}</span>
            ) : (
              <svg className="h-8 w-8" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.12 15.89-5.78l-7.73-6c-2.16 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
            )}
          </div>
          <h1 className="heading-sans text-xl mb-2">
            {isWeChat ? t("auth.welcomeJoin") : t("auth.googleBound")}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mb-5">
            {isWeChat
              ? t("chat.wechatVerifiedDesc")
              : t("chat.googleBoundDesc")}
          </p>

          <ul className="text-left space-y-2.5 mb-6">
            {[
              isWeChat && user?.phone_verified ? t("auth.phoneVerifiedStatus", { phone: user.phone ?? "" }) : null,
              email ? t("auth.emailVerifiedStatus", { email }) : null,
              user ? t("auth.accountLinked", { id: user.name }) : t("common.localAccountLinked"),
              t("auth.profileSynced"),
            ]
              .filter(Boolean)
              .map((line) => (
                <li key={line as string} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                  <span className="text-[var(--teal)] mt-0.5">✓</span>
                  {line}
                </li>
              ))}
          </ul>

          <Link href="/" className="inline-block btn-outline px-6 py-2.5 text-sm font-medium">
            {t("auth.enterDeimos")}
          </Link>
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            {t("auth.autoRedirect", { count: remaining })}
          </p>
        </div>
      </div>
    </div>
  );
}
