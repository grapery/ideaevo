export const OAUTH_MESSAGE_TYPE = "wanye:oauth" as const;

export type OAuthProvider = "google" | "wechat";

export type OAuthBridgeStatus = "success" | "pending" | "error";

export type OAuthMessage = {
  type: typeof OAUTH_MESSAGE_TYPE;
  status: OAuthBridgeStatus;
  provider: OAuthProvider;
  errorCode?: string;
};

export const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  oauth_state: "OAuth 验证失败，请重试",
  oauth_failed: "Google 登录失败，请重试",
  oauth_conflict: "该邮箱已用密码注册，请使用密码登录",
  oauth_token: "登录令牌生成失败，请重试",
  wechat_oauth_failed: "微信登录失败，请重试",
  wechat_not_configured: "微信登录未配置",
  google_not_configured: "Google 登录未配置",
};

export function getOAuthErrorMessage(code?: string): string {
  if (!code) return "登录失败";
  return OAUTH_ERROR_MESSAGES[code] || "登录失败";
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
