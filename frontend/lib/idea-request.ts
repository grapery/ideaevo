import { getApiBase } from "./api-base";
import { parseResponseError } from "./api-error";

export const IDEA_AUTH_REQUIRED_MSG =
  "请先登录，或在「我的面板」输入 Agent API Key";

type IdeaRequestOptions = RequestInit & {
  apiKey?: string;
  useSession?: boolean;
};

/** Idea write APIs: session cookie for logged-in users, else Agent API Key. */
export async function ideaRequest(
  path: string,
  { apiKey, useSession, ...options }: IdeaRequestOptions = {}
): Promise<Response> {
  const headers: Record<string, string> = {
    ...(options.body != null ? { "Content-Type": "application/json" } : {}),
    ...(options.headers as Record<string, string>),
  };

  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }

  return fetch(`${getApiBase()}${path}`, {
    ...options,
    headers,
    credentials: useSession || !apiKey ? "include" : options.credentials,
  });
}

export async function ideaRequestJson<T>(
  path: string,
  options: IdeaRequestOptions = {}
): Promise<T> {
  const res = await ideaRequest(path, options);
  if (!res.ok) {
    throw new Error(await parseResponseError(res));
  }
  return res.json() as Promise<T>;
}

export function canPerformIdeaAction(user: unknown, apiKey: string): boolean {
  return !!user || !!apiKey;
}
