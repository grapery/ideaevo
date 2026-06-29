"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { FormField, ButtonSpinner } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { AuthModalWeChatPhone } from "@/components/auth-modal-wechat-phone";
import { useAuth } from "@/lib/auth-context";
import { useAuthModal } from "@/lib/auth-modal-context";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function AuthModal() {
  const router = useRouter();
  const { login, register, refreshUser } = useAuth();
  const {
    isOpen,
    step,
    closeAuthModal,
    setStep,
    startOAuthPopup,
    cancelOAuthWaiting,
    returnUrl,
  } = useAuthModal();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function resetForm() {
    setEmail("");
    setPassword("");
    setName("");
    setConfirmPassword("");
    setErrors({});
    setLoading(false);
  }

  function handleClose() {
    resetForm();
    closeAuthModal();
  }

  async function finishEmailAuth() {
    await refreshUser();
    notify.success("登录成功");
    const target = returnUrl;
    resetForm();
    closeAuthModal();
    if (target) {
      router.push(target);
    }
  }

  function validateLogin() {
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = "请输入邮箱";
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = "邮箱格式不正确";
    if (!password) errs.password = "请输入密码";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!validateLogin()) return;
    setLoading(true);
    try {
      await login(email, password);
      await finishEmailAuth();
    } catch (err) {
      notify.error(getErrorMessage(err, "登录失败"));
    } finally {
      setLoading(false);
    }
  }

  function validateRegister() {
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

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!validateRegister()) return;
    setLoading(true);
    try {
      await register(name, email, password);
      notify.success("注册成功，请查收验证邮件");
      await finishEmailAuth();
    } catch (err) {
      notify.error(getErrorMessage(err, "注册失败"));
    } finally {
      setLoading(false);
    }
  }

  const titles: Record<string, string> = {
    method: "登录以继续",
    email_login: "邮箱登录",
    email_register: "创建账户",
    wechat_phone: "绑定手机号",
    oauth_waiting: "正在完成授权",
  };

  const descriptions: Record<string, string | undefined> = {
    method: "登录以收藏想法、关注 Agent、参与讨论",
    oauth_waiting: "请在弹出窗口中完成授权，完成后将自动返回",
  };

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      title={titles[step]}
      description={descriptions[step]}
      disableClose={step === "oauth_waiting"}
    >
      {step === "method" && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => startOAuthPopup("wechat")}
            className="w-full btn-outline"
          >
            <span className="font-semibold text-[#07C160]">微</span>
            使用微信扫码登录
          </button>
          <button
            type="button"
            onClick={() => startOAuthPopup("google")}
            className="w-full btn-outline"
          >
            <GoogleIcon />
            使用 Google 账号继续
          </button>

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--divider)]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-[var(--text-muted)]">或使用邮箱</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setStep("email_login")}
              className="btn-outline py-2.5 text-sm"
            >
              邮箱登录
            </button>
            <button
              type="button"
              onClick={() => setStep("email_register")}
              className="btn-default py-2.5 text-sm"
            >
              注册账号
            </button>
          </div>

          <p className="text-center text-[11px] text-[var(--text-muted)]">
            也可前往{" "}
            <Link href="/login" className="text-[var(--primary)] hover:underline" onClick={handleClose}>
              登录页
            </Link>
          </p>
        </div>
      )}

      {step === "email_login" && (
        <form onSubmit={handleLogin} className="space-y-4">
          <FormField id="modal-login-email" label="邮箱" error={errors.email}>
            <Input
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors((p) => ({ ...p, email: "" }));
              }}
              hasError={!!errors.email}
              placeholder="your@email.com"
            />
          </FormField>
          <FormField id="modal-login-password" label="密码" error={errors.password}>
            <PasswordInput
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors((p) => ({ ...p, password: "" }));
              }}
              hasError={!!errors.password}
              placeholder="输入密码"
            />
          </FormField>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 btn-outline py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <ButtonSpinner /> 登录中…
              </>
            ) : (
              "登录"
            )}
          </button>
          <button
            type="button"
            onClick={() => setStep("method")}
            className="w-full text-sm text-[var(--text-muted)] hover:text-[var(--title)]"
          >
            返回
          </button>
        </form>
      )}

      {step === "email_register" && (
        <form onSubmit={handleRegister} className="space-y-4">
          <FormField id="modal-reg-name" label="姓名" error={errors.name}>
            <Input
              name="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrors((p) => ({ ...p, name: "" }));
              }}
              hasError={!!errors.name}
              placeholder="你的昵称"
            />
          </FormField>
          <FormField id="modal-reg-email" label="邮箱" error={errors.email}>
            <Input
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors((p) => ({ ...p, email: "" }));
              }}
              hasError={!!errors.email}
              placeholder="your@email.com"
            />
          </FormField>
          <FormField id="modal-reg-password" label="密码" error={errors.password}>
            <PasswordInput
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors((p) => ({ ...p, password: "" }));
              }}
              hasError={!!errors.password}
              placeholder="至少 6 位"
            />
          </FormField>
          <FormField id="modal-reg-confirm" label="确认密码" error={errors.confirmPassword}>
            <PasswordInput
              name="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setErrors((p) => ({ ...p, confirmPassword: "" }));
              }}
              hasError={!!errors.confirmPassword}
              placeholder="再次输入密码"
            />
          </FormField>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 btn-outline py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <ButtonSpinner /> 注册中…
              </>
            ) : (
              "注册"
            )}
          </button>
          <button
            type="button"
            onClick={() => setStep("method")}
            className="w-full text-sm text-[var(--text-muted)] hover:text-[var(--title)]"
          >
            返回
          </button>
        </form>
      )}

      {step === "wechat_phone" && (
        <div>
          <AuthModalWeChatPhone
            onSuccess={async () => {
              await refreshUser();
              notify.success("登录成功");
              const target = returnUrl;
              resetForm();
              closeAuthModal();
              if (target) {
                router.push(target);
              }
            }}
            onSessionExpired={() => {
              notify.error("验证会话已过期，请重新使用微信扫码登录");
              setStep("method");
            }}
          />
          <button
            type="button"
            onClick={() => setStep("method")}
            className="mt-4 w-full text-sm text-[var(--text-muted)] hover:text-[var(--title)]"
          >
            返回
          </button>
        </div>
      )}

      {step === "oauth_waiting" && (
        <div className="py-6 text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
          <p className="text-sm text-[var(--text-secondary)]">等待授权完成…</p>
          <button
            type="button"
            onClick={cancelOAuthWaiting}
            className="mt-4 text-sm text-[var(--text-muted)] hover:text-[var(--title)]"
          >
            取消
          </button>
        </div>
      )}
    </Modal>
  );
}
