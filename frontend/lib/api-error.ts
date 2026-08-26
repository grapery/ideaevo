/** Parse backend API errors into locale-aware user-facing messages. */

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  normalizeLocale,
  type Locale,
} from "@/lib/i18n/messages";

type Localized = { "zh-CN": string; en: string };

const ERROR_MAP: Record<string, Localized> = {
  // Auth / user
  "email already registered": {
    "zh-CN": "该邮箱已被注册",
    en: "This email is already registered",
  },
  "invalid token": {
    "zh-CN": "链接无效或已过期",
    en: "Invalid or expired link",
  },
  "token expired": {
    "zh-CN": "链接已过期，请重新申请",
    en: "Link expired. Please request a new one",
  },
  "invalid credentials": {
    "zh-CN": "邮箱或密码错误",
    en: "Incorrect email or password",
  },
  "email already registered with password login": {
    "zh-CN": "该邮箱已用密码注册，请使用密码登录",
    en: "This email is registered with a password. Please sign in with password",
  },
  "invalid phone number": {
    "zh-CN": "手机号格式不正确",
    en: "Invalid phone number",
  },
  "phone already bound to another account": {
    "zh-CN": "该手机号已绑定其他账号",
    en: "This phone number is linked to another account",
  },
  "bio too long": {
    "zh-CN": "个人简介不能超过 500 字",
    en: "Bio cannot exceed 500 characters",
  },
  "invalid avatar_url": {
    "zh-CN": "头像地址无效",
    en: "Invalid avatar URL",
  },
  "avatar_url must be from allowed storage": {
    "zh-CN": "头像须来自允许的上传存储",
    en: "Avatar must come from allowed storage",
  },
  "invalid background_url": {
    "zh-CN": "背景图地址无效",
    en: "Invalid background URL",
  },
  "background_url must be from allowed storage": {
    "zh-CN": "背景图须来自允许的上传存储",
    en: "Background must come from allowed storage",
  },
  "password required": {
    "zh-CN": "请输入密码确认",
    en: "Password is required to confirm",
  },
  "incorrect password": {
    "zh-CN": "密码不正确",
    en: "Incorrect password",
  },
  insufficient_flowers: {
    "zh-CN": "今日可送的花已用完",
    en: "No flowers left to send today",
  },
  flower_sender_required: {
    "zh-CN": "无法确定送花账户，请先登录",
    en: "Cannot resolve flower account. Please sign in",
  },
  "type DELETE to confirm": {
    "zh-CN": "请输入 DELETE 确认注销",
    en: "Type DELETE to confirm account deletion",
  },
  "phone not verified": {
    "zh-CN": "请先完成手机验证",
    en: "Please verify your phone first",
  },
  "sms service unavailable": {
    "zh-CN": "短信服务不可用",
    en: "SMS service unavailable",
  },
  "phone mismatch": {
    "zh-CN": "手机号与绑定号码不一致",
    en: "Phone number does not match the linked number",
  },
  "unsupported auth provider": {
    "zh-CN": "不支持的登录方式",
    en: "Unsupported sign-in method",
  },
  "oauth accounts have no password": {
    "zh-CN": "第三方登录账号无法修改密码",
    en: "OAuth accounts cannot change password",
  },
  "incorrect current password": {
    "zh-CN": "当前密码不正确",
    en: "Current password is incorrect",
  },
  // SMS
  "please wait before requesting another code": {
    "zh-CN": "请稍后再获取验证码",
    en: "Please wait before requesting another code",
  },
  "daily sms limit reached": {
    "zh-CN": "今日验证码发送次数已达上限",
    en: "Daily SMS limit reached",
  },
  "invalid or expired code": {
    "zh-CN": "验证码无效或已过期",
    en: "Invalid or expired code",
  },
  "code expired": {
    "zh-CN": "验证码已过期",
    en: "Code expired",
  },
  "invalid code": {
    "zh-CN": "验证码错误",
    en: "Invalid code",
  },
  // Upload
  "object storage not configured": {
    "zh-CN": "对象存储未配置",
    en: "Object storage is not configured",
  },
  "invalid kind": {
    "zh-CN": "上传类型无效",
    en: "Invalid upload type",
  },
  "unsupported content type": {
    "zh-CN": "不支持的文件类型",
    en: "Unsupported file type",
  },
  "url not allowed": {
    "zh-CN": "文件地址不允许",
    en: "URL not allowed",
  },
  "invalid object key": {
    "zh-CN": "文件标识无效",
    en: "Invalid object key",
  },
  "object key not owned by user": {
    "zh-CN": "无权访问该文件",
    en: "You do not own this file",
  },
  "file too large": {
    "zh-CN": "文件不能超过 5MB",
    en: "File cannot exceed 5MB",
  },
  "invalid content type": {
    "zh-CN": "文件类型无效",
    en: "Invalid content type",
  },
  "uploaded object not found": {
    "zh-CN": "上传的文件不存在，请重新上传",
    en: "Uploaded file not found. Please upload again",
  },
  // Agent / ideas
  "invalid api key": {
    "zh-CN": "API Key 无效",
    en: "Invalid API key",
  },
  "missing or invalid authorization": {
    "zh-CN": "缺少或无效的授权信息",
    en: "Missing or invalid authorization",
  },
  "idea not found": {
    "zh-CN": "想法不存在",
    en: "Idea not found",
  },
  "agent not found": {
    "zh-CN": "Agent 不存在",
    en: "Agent not found",
  },
  "cannot send flowers to inactive idea": {
    "zh-CN": "无法对非活跃想法送花",
    en: "Cannot send flowers to an inactive idea",
  },
  "cannot fork inactive idea": {
    "zh-CN": "无法 Fork 非活跃想法",
    en: "Cannot fork an inactive idea",
  },
  "this agent does not allow follows": {
    "zh-CN": "该 Agent 已关闭关注",
    en: "This Agent does not allow follows",
  },
  "this agent does not accept chats": {
    "zh-CN": "该 Agent 暂不接受对话",
    en: "This Agent does not accept chats",
  },
  "original idea not found": {
    "zh-CN": "原始想法不存在",
    en: "Original idea not found",
  },
  "you have already forked this idea": {
    "zh-CN": "你已经 fork 过这个想法了",
    en: "You have already forked this idea",
  },
  "cannot comment on inactive idea": {
    "zh-CN": "无法评论非活跃想法",
    en: "Cannot comment on an inactive idea",
  },
  "只有想法的创建者才能更新附加信息": {
    "zh-CN": "只有想法的创建者才能更新附加信息",
    en: "Only the idea owner can update metadata",
  },
  "只有想法的创建者才能上传图标": {
    "zh-CN": "只有想法的创建者才能上传图标",
    en: "Only the idea owner can upload an icon",
  },
  "icon_url must be from allowed storage": {
    "zh-CN": "图标须来自允许的上传存储",
    en: "Icon must come from allowed storage",
  },
  "invalid impl_status, must be one of: concept, in_progress, implemented, paused": {
    "zh-CN": "实现状态无效",
    en: "Invalid implementation status",
  },
  "invalid icon_url": {
    "zh-CN": "图标地址无效",
    en: "Invalid icon URL",
  },
  "description is required": {
    "zh-CN": "描述不能为空",
    en: "Description is required",
  },
  "description image must be from allowed storage": {
    "zh-CN": "描述图片须来自允许的上传存储",
    en: "Description image must come from allowed storage",
  },
  "description image must belong to this idea": {
    "zh-CN": "描述图片须属于当前想法",
    en: "Description image must belong to this idea",
  },
  "invalid description image": {
    "zh-CN": "描述图片地址无效",
    en: "Invalid description image",
  },
  "只有想法的创建者才能编辑描述": {
    "zh-CN": "只有想法的创建者才能编辑描述",
    en: "Only the idea owner can edit the description",
  },
  "只有想法的创建者才能上传资源": {
    "zh-CN": "只有想法的创建者才能上传资源",
    en: "Only the idea owner can upload assets",
  },
  "version not found": {
    "zh-CN": "版本不存在",
    en: "Version not found",
  },
  "session not found": {
    "zh-CN": "对话不存在",
    en: "Session not found",
  },
  // Middleware
  "login required": {
    "zh-CN": "请先登录",
    en: "Please sign in first",
  },
  "invalid session": {
    "zh-CN": "登录已失效，请重新登录",
    en: "Session expired. Please sign in again",
  },
  "user not found": {
    "zh-CN": "用户不存在",
    en: "User not found",
  },
  // Handler static
  "password must be 6-128 chars": {
    "zh-CN": "密码长度需为 6-128 个字符",
    en: "Password must be 6–128 characters",
  },
  "upload not configured": {
    "zh-CN": "图片上传服务未配置",
    en: "Upload service is not configured",
  },
  "sms not configured": {
    "zh-CN": "短信服务未配置",
    en: "SMS is not configured",
  },
  "content is required": {
    "zh-CN": "请输入消息内容",
    en: "Content is required",
  },
  "missing token": {
    "zh-CN": "缺少验证令牌",
    en: "Missing verification token",
  },
};

function resolveLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`),
  );
  return normalizeLocale(match?.[1] ? decodeURIComponent(match[1]) : null);
}

function pick(loc: Localized, locale: Locale): string {
  return loc[locale] ?? loc[DEFAULT_LOCALE];
}

function defaultFallback(locale: Locale): string {
  return locale === "en" ? "Operation failed" : "操作失败";
}

function mapBindValidation(message: string, locale: Locale): string | null {
  const zh = locale === "zh-CN";
  if (/Field validation for 'Email' failed on the 'email' tag/i.test(message)) {
    return zh ? "邮箱格式不正确" : "Invalid email format";
  }
  if (/Field validation for 'Email' failed on the 'required' tag/i.test(message)) {
    return zh ? "请输入邮箱" : "Email is required";
  }
  if (/Field validation for 'Password' failed on the 'required' tag/i.test(message)) {
    return zh ? "请输入密码" : "Password is required";
  }
  if (/Field validation for 'NewPassword' failed on the 'min' tag/i.test(message)) {
    return zh ? "新密码至少 6 个字符" : "New password must be at least 6 characters";
  }
  if (/binding:"required"/i.test(message) || /failed on the 'required' tag/i.test(message)) {
    return zh ? "请填写必填项" : "Please fill in required fields";
  }
  if (/failed on the 'email' tag/i.test(message)) {
    return zh ? "邮箱格式不正确" : "Invalid email format";
  }
  if (/failed on the 'min' tag/i.test(message)) {
    return zh ? "输入内容长度不足" : "Input is too short";
  }
  if (/failed on the 'max' tag/i.test(message)) {
    return zh ? "输入内容过长" : "Input is too long";
  }
  if (/EOF|invalid character|cannot unmarshal/i.test(message)) {
    return zh ? "请求格式无效" : "Invalid request format";
  }
  return null;
}

export function formatApiError(message: string, fallback?: string): string {
  const locale = resolveLocale();
  const fb = fallback ?? defaultFallback(locale);
  const trimmed = message.trim();
  if (!trimmed) return fb;

  if (ERROR_MAP[trimmed]) return pick(ERROR_MAP[trimmed], locale);

  const bindMsg = mapBindValidation(trimmed, locale);
  if (bindMsg) return bindMsg;

  if (trimmed.startsWith("uploaded object not found")) {
    return pick(ERROR_MAP["uploaded object not found"], locale);
  }
  if (trimmed.startsWith("sms failed:")) {
    return locale === "en"
      ? "Failed to send SMS. Please try again later"
      : "短信发送失败，请稍后重试";
  }
  if (trimmed.startsWith("you have already forked this idea")) {
    return pick(ERROR_MAP["you have already forked this idea"], locale);
  }
  if (trimmed.startsWith("duplicate fork content")) {
    return locale === "en"
      ? "You already forked identical content (same title and description). Modify it and try again"
      : "已提交过完全相同的 Fork（标题与描述都一致），请修改后再试";
  }
  if (trimmed.startsWith("invalid URL:")) {
    return locale === "en"
      ? "Invalid URL. Use http:// or https://"
      : "链接地址无效，请使用 http:// 或 https:// 开头";
  }

  // Already-localized Chinese messages from backend.
  if (/[\u4e00-\u9fff]/.test(trimmed)) {
    if (ERROR_MAP[trimmed]) return pick(ERROR_MAP[trimmed], locale);
    return trimmed;
  }

  return trimmed || fb;
}

export async function parseResponseError(res: Response, fallback?: string): Promise<string> {
  const locale = resolveLocale();
  const defaultFallback =
    fallback ??
    (locale === "en"
      ? `Request failed (${res.status})`
      : `请求失败 (${res.status})`);
  try {
    const body = await res.json();
    const raw = body?.error ?? body?.message;
    if (typeof raw === "string") return formatApiError(raw, defaultFallback);
    if (Array.isArray(raw) && typeof raw[0] === "string") {
      return formatApiError(raw[0], defaultFallback);
    }
  } catch {
    // non-JSON body
  }
  return formatApiError(res.statusText, defaultFallback);
}

export function getErrorMessage(err: unknown, fallback?: string): string {
  const locale = resolveLocale();
  const fb = fallback ?? defaultFallback(locale);
  if (err instanceof Error && err.message) {
    return formatApiError(err.message, fb);
  }
  if (typeof err === "string") {
    return formatApiError(err, fb);
  }
  return fb;
}
