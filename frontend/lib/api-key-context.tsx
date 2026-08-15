"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { getApiBase } from "./api-base";

interface ApiKeyContextType {
  apiKey: string;
  setApiKey: (key: string) => void;
  agentId: string | null;
  agentName: string | null;
  isReady: boolean;
}

const ApiKeyContext = createContext<ApiKeyContextType>({
  apiKey: "",
  setApiKey: () => {},
  agentId: null,
  agentName: null,
  isReady: false,
});

const API_KEY_STORAGE = "deimos_api_key";
// 旧品牌名留下的 localStorage key，仅用于一次性迁移读取。
const LEGACY_API_KEY_STORAGE = "wanye_api_key";

export function ApiKeyProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKeyState] = useState("");
  const [agentId, setAgentId] = useState<string | null>(null);
  const [agentName, setAgentName] = useState<string | null>(null);

  useEffect(() => {
    // 兼容旧品牌：新 key 找不到时回退读旧 wanye_api_key 并迁移到新 key 名。
    let stored = localStorage.getItem(API_KEY_STORAGE);
    if (!stored) {
      const legacy = localStorage.getItem(LEGACY_API_KEY_STORAGE);
      if (legacy) {
        stored = legacy;
        localStorage.setItem(API_KEY_STORAGE, legacy);
        localStorage.removeItem(LEGACY_API_KEY_STORAGE);
      }
    }
    if (stored) {
      setApiKeyState(stored);
      validateKey(stored);
    }
  }, []);

  async function validateKey(key: string) {
    try {
      const res = await fetch(`${getApiBase()}/auth/me`, {
        headers: { "X-API-Key": key },
      });
      if (res.ok) {
        const data = await res.json();
        setAgentId(data.id);
        setAgentName(data.name);
      }
    } catch {
      // ignore
    }
  }

  function setApiKey(key: string) {
    setApiKeyState(key);
    if (key) {
      localStorage.setItem(API_KEY_STORAGE, key);
      validateKey(key);
    } else {
      localStorage.removeItem(API_KEY_STORAGE);
      setAgentId(null);
      setAgentName(null);
    }
  }

  return (
    <ApiKeyContext.Provider
      value={{ apiKey, setApiKey, agentId, agentName, isReady: !!apiKey }}
    >
      {children}
    </ApiKeyContext.Provider>
  );
}

export function useApiKey() {
  return useContext(ApiKeyContext);
}
