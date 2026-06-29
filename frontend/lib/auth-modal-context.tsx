"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { getApiBase } from "./api-base";
import { useAuth } from "./auth-context";
import { notify } from "@/components/ui/notify";
import {
  getOAuthErrorMessage,
  isOAuthMessage,
  type OAuthMessage,
  type OAuthProvider,
} from "./oauth";

export type AuthModalStep =
  | "method"
  | "email_login"
  | "email_register"
  | "wechat_phone"
  | "oauth_waiting";

type OpenAuthModalOptions = {
  returnUrl?: string;
  initialStep?: AuthModalStep;
};

type AuthModalContextType = {
  isOpen: boolean;
  step: AuthModalStep;
  returnUrl: string | null;
  openAuthModal: (options?: OpenAuthModalOptions) => void;
  closeAuthModal: () => void;
  setStep: (step: AuthModalStep) => void;
  startOAuthPopup: (provider: OAuthProvider) => void;
  cancelOAuthWaiting: () => void;
};

const AuthModalContext = createContext<AuthModalContextType>({
  isOpen: false,
  step: "method",
  returnUrl: null,
  openAuthModal: () => {},
  closeAuthModal: () => {},
  setStep: () => {},
  startOAuthPopup: () => {},
  cancelOAuthWaiting: () => {},
});

const POPUP_NAME = "wanye_oauth_popup";
const POPUP_FEATURES = "width=520,height=720,menubar=no,toolbar=no,location=yes,status=no";

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<AuthModalStep>("method");
  const [returnUrl, setReturnUrl] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);
  const popupPollRef = useRef<number | null>(null);

  const clearPopupPoll = useCallback(() => {
    if (popupPollRef.current !== null) {
      window.clearInterval(popupPollRef.current);
      popupPollRef.current = null;
    }
  }, []);

  const closePopup = useCallback(() => {
    clearPopupPoll();
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close();
    }
    popupRef.current = null;
  }, [clearPopupPoll]);

  const closeAuthModal = useCallback(() => {
    closePopup();
    setIsOpen(false);
    setStep("method");
    setReturnUrl(null);
  }, [closePopup]);

  const finishLogin = useCallback(async () => {
    await refreshUser();
    notify.success("登录成功");
    const target = returnUrl;
    closeAuthModal();
    if (target) {
      router.push(target);
    }
  }, [refreshUser, returnUrl, closeAuthModal, router]);

  const handleOAuthMessage = useCallback(
    async (msg: OAuthMessage) => {
      if (!isOAuthMessage(msg)) return;

      closePopup();

      if (msg.status === "success") {
        await finishLogin();
        return;
      }

      if (msg.status === "pending" && msg.provider === "wechat") {
        setStep("wechat_phone");
        return;
      }

      setStep("method");
      if (msg.errorCode === "oauth_conflict") {
        notify.error(getOAuthErrorMessage(msg.errorCode));
        setStep("email_login");
        return;
      }
      notify.error(getOAuthErrorMessage(msg.errorCode));
    },
    [closePopup, finishLogin]
  );

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (!isOAuthMessage(event.data)) return;
      void handleOAuthMessage(event.data);
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [handleOAuthMessage]);

  const openAuthModal = useCallback((options?: OpenAuthModalOptions) => {
    setReturnUrl(options?.returnUrl ?? null);
    setStep(options?.initialStep ?? "method");
    setIsOpen(true);
  }, []);

  const startOAuthPopup = useCallback(
    (provider: OAuthProvider) => {
      closePopup();
      const url = `${getApiBase()}/auth/${provider}?mode=popup`;
      const popup = window.open(url, POPUP_NAME, POPUP_FEATURES);

      if (!popup) {
        notify.error("无法打开登录窗口，请允许弹窗后重试");
        return;
      }

      popupRef.current = popup;
      setStep("oauth_waiting");

      popupPollRef.current = window.setInterval(() => {
        if (!popupRef.current || popupRef.current.closed) {
          clearPopupPoll();
          popupRef.current = null;
          setStep((current) => (current === "oauth_waiting" ? "method" : current));
        }
      }, 500);
    },
    [closePopup, clearPopupPoll]
  );

  const cancelOAuthWaiting = useCallback(() => {
    closePopup();
    setStep("method");
  }, [closePopup]);

  return (
    <AuthModalContext.Provider
      value={{
        isOpen,
        step,
        returnUrl,
        openAuthModal,
        closeAuthModal,
        setStep,
        startOAuthPopup,
        cancelOAuthWaiting,
      }}
    >
      {children}
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  return useContext(AuthModalContext);
}
