/** 解析后端 API 错误并映射为用户可读的中文提示 */

const ERROR_MAP: Record<string, string> = {
  // Auth / user
  "email already registered": "该邮箱已被注册",
  "invalid token": "链接无效或已过期",
  "token expired": "链接已过期，请重新申请",
  "invalid credentials": "邮箱或密码错误",
  "email already registered with password login": "该邮箱已用密码注册，请使用密码登录",
  "invalid phone number": "手机号格式不正确",
  "phone already bound to another account": "该手机号已绑定其他账号",
  "bio too long": "个人简介不能超过 500 字",
  "invalid avatar_url": "头像地址无效",
  "avatar_url must be from allowed storage": "头像须来自允许的上传存储",
  "invalid background_url": "背景图地址无效",
  "background_url must be from allowed storage": "背景图须来自允许的上传存储",
  "password required": "请输入密码确认",
  "incorrect password": "密码不正确",
  "type DELETE to confirm": "请输入 DELETE 确认注销",
  "phone not verified": "请先完成手机验证",
  "sms service unavailable": "短信服务不可用",
  "phone mismatch": "手机号与绑定号码不一致",
  "unsupported auth provider": "不支持的登录方式",
  "oauth accounts have no password": "第三方登录账号无法修改密码",
  "incorrect current password": "当前密码不正确",
  // SMS
  "please wait before requesting another code": "请稍后再获取验证码",
  "daily sms limit reached": "今日验证码发送次数已达上限",
  "invalid or expired code": "验证码无效或已过期",
  "code expired": "验证码已过期",
  "invalid code": "验证码错误",
  // Upload
  "object storage not configured": "对象存储未配置",
  "invalid kind": "上传类型无效",
  "unsupported content type": "不支持的文件类型",
  "url not allowed": "文件地址不允许",
  "invalid object key": "文件标识无效",
  "object key not owned by user": "无权访问该文件",
  "file too large": "文件不能超过 5MB",
  "invalid content type": "文件类型无效",
  "uploaded object not found": "上传的文件不存在，请重新上传",
  // Agent / ideas
  "invalid api key": "API Key 无效",
  "missing or invalid authorization": "缺少或无效的授权信息",
  "idea not found": "想法不存在",
  "agent not found": "Agent 不存在",
  "cannot send flowers to inactive idea": "无法给非活跃想法送花",
  "cannot fork inactive idea": "无法 Fork 非活跃想法",
  "original idea not found": "原始想法不存在",
  "you have already forked this idea": "你已经 fork 过这个想法了",
  "cannot comment on inactive idea": "无法评论非活跃想法",
  "session not found": "对话不存在",
  // Middleware
  "login required": "请先登录",
  "invalid session": "登录已失效，请重新登录",
  "user not found": "用户不存在",
  // Handler static
  "password must be 6-128 chars": "密码长度需为 6-128 个字符",
  "upload not configured": "图片上传服务未配置",
  "sms not configured": "短信服务未配置",
  "content is required": "请输入消息内容",
  "missing token": "缺少验证令牌",
};

function mapBindValidation(message: string): string | null {
  if (/Field validation for 'Email' failed on the 'email' tag/i.test(message)) {
    return "邮箱格式不正确";
  }
  if (/Field validation for 'Email' failed on the 'required' tag/i.test(message)) {
    return "请输入邮箱";
  }
  if (/Field validation for 'Password' failed on the 'required' tag/i.test(message)) {
    return "请输入密码";
  }
  if (/Field validation for 'NewPassword' failed on the 'min' tag/i.test(message)) {
    return "新密码至少 6 个字符";
  }
  if (/binding:"required"/i.test(message) || /failed on the 'required' tag/i.test(message)) {
    return "请填写必填项";
  }
  if (/failed on the 'email' tag/i.test(message)) {
    return "邮箱格式不正确";
  }
  if (/failed on the 'min' tag/i.test(message)) {
    return "输入内容长度不足";
  }
  if (/failed on the 'max' tag/i.test(message)) {
    return "输入内容过长";
  }
  if (/EOF|invalid character|cannot unmarshal/i.test(message)) {
    return "请求格式无效";
  }
  return null;
}

export function formatApiError(message: string, fallback = "操作失败"): string {
  const trimmed = message.trim();
  if (!trimmed) return fallback;

  if (ERROR_MAP[trimmed]) return ERROR_MAP[trimmed];

  const bindMsg = mapBindValidation(trimmed);
  if (bindMsg) return bindMsg;

  if (trimmed.startsWith("uploaded object not found")) {
    return ERROR_MAP["uploaded object not found"];
  }
  if (trimmed.startsWith("sms failed:")) {
    return "短信发送失败，请稍后重试";
  }
  if (trimmed.startsWith("you have already forked this idea")) {
    return ERROR_MAP["you have already forked this idea"];
  }

  if (/[\u4e00-\u9fff]/.test(trimmed)) return trimmed;

  return trimmed || fallback;
}

export async function parseResponseError(res: Response, fallback?: string): Promise<string> {
  const defaultFallback = fallback ?? `请求失败 (${res.status})`;
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

export function getErrorMessage(err: unknown, fallback = "操作失败"): string {
  if (err instanceof Error && err.message) {
    return formatApiError(err.message, fallback);
  }
  if (typeof err === "string") {
    return formatApiError(err, fallback);
  }
  return fallback;
}
