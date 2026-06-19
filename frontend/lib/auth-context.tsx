"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { User } from "./types";
import { authApi } from "./api-client";
import { getApiBase } from "./api-base";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loginWithGoogle: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  loginWithGoogle: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    try {
      const data = await authApi.me();
      setUser(data.user);
    } catch (err) {
      // Only clear the session on a real auth failure (4xx), not a network blip.
      // A transient network error should not log the user out.
      const status = err instanceof Error ? err.message : "";
      if (/API error: 4\d\d|^40\d|unauthorized/i.test(status)) {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const data = await authApi.login(email, password);
    setUser(data.user);
  }

  async function register(name: string, email: string, password: string) {
    const data = await authApi.register(name, email, password);
    setUser(data.user);
  }

  async function logout() {
    // Always clear local state so a server hiccup doesn't leave the user stuck
    // logged-in. Best-effort server-side logout.
    try {
      await authApi.logout();
    } catch {
      // ignore network errors; we still clear the client session below
    }
    setUser(null);
  }

  function loginWithGoogle() {
    window.location.href = `${getApiBase()}/auth/google`;
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, loginWithGoogle }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
