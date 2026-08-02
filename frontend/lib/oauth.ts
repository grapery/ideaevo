import {
  createTranslator,
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  normalizeLocale,
  type TranslationKey,
} from "@/lib/i18n/messages";

export const OAUTH_MESSAGE_TYPE = "deimos:oauth" as const;

export type OAuthProvider = "google" | "wechat";

export type OAuthBridgeStatus = "success" | "pending" | "error";

export type OAuthMessage = {
  type: typeof OAUTH_MESSAGE_TYPE;
  status: OAuthBridgeStatus;
  provider: OAuthProvider;
  errorCode?: string;
};

const OAUTH_ERROR_KEYS: Record<string, TranslationKey> = {
  oauth_state: "auth.oauthStateError",
  oauth_failed: "auth.oauthFailedError",
  oauth_conflict: "auth.oauthConflictError",
  oauth_token: "auth.oauthTokenError",
  wechat_oauth_failed: "auth.wechatFailedError",
  wechat_not_configured: "auth.wechatNotConfiguredError",
  google_not_configured: "auth.googleNotConfiguredError",
};

function resolveLocale() {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`),
  );
  return normalizeLocale(match?.[1] ? decodeURIComponent(match[1]) : null);
}

export function getOAuthErrorMessage(code?: string): string {
  const t = createTranslator(resolveLocale());
  if (!code) return t("auth.loginFailed");
  const key = OAUTH_ERROR_KEYS[code];
  return key ? t(key) : t("auth.loginFailed");
}

export function isOAuthMessage(data: unknown): data is OAuthMessage {
  if (!data || typeof data !== "object") return false;
  const msg = data as Partial<OAuthMessage>;
  return (
    msg.type === OAUTH_MESSAGE_TYPE &&
    (msg.status === "success" || msg.status === "pending" || msg.status === "error") &&
    (msg.provider === "google" || msg.provider === "wechat")
  );
}
