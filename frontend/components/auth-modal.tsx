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
import { useI18n } from "@/lib/i18n/provider";
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
  const { t } = useI18n();
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
    notify.success(t("auth.loginSuccess"));
    const target = returnUrl;
    resetForm();
    closeAuthModal();
    if (target) {
      router.push(target);
    }
  }

  function validateLogin() {
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = t("auth.errEmailRequired");
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = t("auth.errEmailInvalid");
    if (!password) errs.password = t("auth.errPasswordRequired");
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
      notify.error(getErrorMessage(err, t("auth.loginFailed")));
    } finally {
      setLoading(false);
    }
  }

  function validateRegister() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = t("auth.errNameRequired");
    if (!email.trim()) errs.email = t("auth.errEmailRequired");
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = t("auth.errEmailInvalid");
    if (!password) errs.password = t("auth.errPasswordRequired");
    else if (password.length < 6) errs.password = t("auth.errPasswordShort");
    if (password !== confirmPassword) errs.confirmPassword = t("auth.errPasswordMismatch");
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!validateRegister()) return;
    setLoading(true);
    try {
      await register(name, email, password);
      notify.success(t("auth.registerSuccess"));
      await finishEmailAuth();
    } catch (err) {
      notify.error(getErrorMessage(err, t("auth.registerFailed")));
    } finally {
      setLoading(false);
    }
  }

  const titles: Record<string, string> = {
    method: t("auth.stepLoginContinue"),
    email_login: t("auth.stepEmailLogin"),
    email_register: t("auth.createAccount"),
    wechat_phone: t("auth.bindPhoneTitle"),
    oauth_waiting: t("auth.stepAuthorizing"),
  };

  const descriptions: Record<string, string | undefined> = {
    method: t("auth.stepLoginHint"),
    oauth_waiting: t("auth.stepOAuthWaiting"),
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
            <span className="font-semibold text-[#07C160]">{t("auth.wechat")}</span>
            {t("auth.wechatScanLogin")}
          </button>
          <button
            type="button"
            onClick={() => startOAuthPopup("google")}
            className="w-full btn-outline"
          >
            <GoogleIcon />
            {t("auth.googleContinue")}
          </button>

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--divider)]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-[var(--text-muted)]">{t("auth.or")}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setStep("email_login")}
              className="btn-outline py-2.5 text-sm"
            >
              {t("auth.login")}
            </button>
            <button
              type="button"
              onClick={() => setStep("email_register")}
              className="btn-default py-2.5 text-sm"
            >
              {t("auth.register")}
            </button>
          </div>

          <p className="text-center text-[11px] text-[var(--text-muted)]">
            {t("auth.welcomeBack")}{" "}
            <Link href="/login" className="text-[var(--primary)] hover:underline" onClick={handleClose}>
              {t("auth.login")}
            </Link>
          </p>
        </div>
      )}

      {step === "email_login" && (
        <form onSubmit={handleLogin} className="space-y-4">
          <FormField id="modal-login-email" label={t("auth.email")} error={errors.email}>
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
              placeholder={t("auth.emailPlaceholder")}
            />
          </FormField>
          <FormField id="modal-login-password" label={t("auth.password")} error={errors.password}>
            <PasswordInput
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors((p) => ({ ...p, password: "" }));
              }}
              hasError={!!errors.password}
              placeholder={t("auth.passwordPlaceholder")}
            />
          </FormField>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 btn-outline py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <ButtonSpinner /> {t("auth.loggingIn")}
              </>
            ) : (
              t("auth.loginShort")
            )}
          </button>
          <button
            type="button"
            onClick={() => setStep("method")}
            className="w-full text-sm text-[var(--text-muted)] hover:text-[var(--title)]"
          >
            {t("auth.back")}
          </button>
        </form>
      )}

      {step === "email_register" && (
        <form onSubmit={handleRegister} className="space-y-4">
          <FormField id="modal-reg-name" label={t("auth.name")} error={errors.name}>
            <Input
              name="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrors((p) => ({ ...p, name: "" }));
              }}
              hasError={!!errors.name}
              placeholder={t("auth.namePlaceholder")}
            />
          </FormField>
          <FormField id="modal-reg-email" label={t("auth.email")} error={errors.email}>
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
              placeholder={t("auth.emailPlaceholder")}
            />
          </FormField>
          <FormField id="modal-reg-password" label={t("auth.password")} error={errors.password}>
            <PasswordInput
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors((p) => ({ ...p, password: "" }));
              }}
              hasError={!!errors.password}
              placeholder={t("auth.newPasswordPlaceholder")}
            />
          </FormField>
          <FormField id="modal-reg-confirm" label={t("auth.confirmPassword")} error={errors.confirmPassword}>
            <PasswordInput
              name="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setErrors((p) => ({ ...p, confirmPassword: "" }));
              }}
              hasError={!!errors.confirmPassword}
              placeholder={t("auth.confirmPasswordPlaceholder")}
            />
          </FormField>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 btn-outline py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <ButtonSpinner /> {t("auth.registering")}
              </>
            ) : (
              t("auth.registerShort")
            )}
          </button>
          <button
            type="button"
            onClick={() => setStep("method")}
            className="w-full text-sm text-[var(--text-muted)] hover:text-[var(--title)]"
          >
            {t("auth.back")}
          </button>
        </form>
      )}

      {step === "wechat_phone" && (
        <div>
          <AuthModalWeChatPhone
            onSuccess={async () => {
              await refreshUser();
              notify.success(t("auth.loginSuccess"));
              const target = returnUrl;
              resetForm();
              closeAuthModal();
              if (target) {
                router.push(target);
              }
            }}
            onSessionExpired={() => {
              notify.error(t("auth.sessionExpiredHint"));
              setStep("method");
            }}
          />
          <button
            type="button"
            onClick={() => setStep("method")}
            className="mt-4 w-full text-sm text-[var(--text-muted)] hover:text-[var(--title)]"
          >
            {t("auth.back")}
          </button>
        </div>
      )}

      {step === "oauth_waiting" && (
        <div className="py-6 text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
          <p className="text-sm text-[var(--text-secondary)]">{t("auth.waitingAuth")}</p>
          <button
            type="button"
            onClick={cancelOAuthWaiting}
            className="mt-4 text-sm text-[var(--text-muted)] hover:text-[var(--title)]"
          >
            {t("common.cancel")}
          </button>
        </div>
      )}
    </Modal>
  );
}
