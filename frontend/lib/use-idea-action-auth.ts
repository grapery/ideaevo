"use client";

import { useApiKey } from "./api-key-context";
import { useAuth } from "./auth-context";
import { canPerformIdeaAction } from "./idea-request";

export function useIdeaActionAuth() {
  const { user } = useAuth();
  const { apiKey, isReady } = useApiKey();

  return {
    user,
    apiKey,
    isReady,
    canAct: canPerformIdeaAction(user, apiKey),
    useSession: !!user,
  };
}
