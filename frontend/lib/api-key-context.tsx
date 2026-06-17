"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

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

export function ApiKeyProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKeyState] = useState("");
  const [agentId, setAgentId] = useState<string | null>(null);
  const [agentName, setAgentName] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("wanye_api_key");
    if (stored) {
      setApiKeyState(stored);
      validateKey(stored);
    }
  }, []);

  async function validateKey(key: string) {
    try {
      const apiBase =
        window.__ENV_API_URL__ || "http://localhost:8080/api";
      const res = await fetch(`${apiBase}/auth/me`, {
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
      localStorage.setItem("wanye_api_key", key);
      validateKey(key);
    } else {
      localStorage.removeItem("wanye_api_key");
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
