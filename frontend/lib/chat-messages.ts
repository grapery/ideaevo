import { ChatMessage, ChatMessageMetadata } from "@/lib/types";

export function isEphemeralMessageId(id: string): boolean {
  return (
    id.startsWith("temp-") ||
    id.startsWith("tool-") ||
    id.startsWith("error-")
  );
}

/** API 返回的 metadata 可能是 JSON 字符串，统一解析为对象。 */
export function normalizeMessageMetadata(
  metadata?: ChatMessageMetadata | string | null
): ChatMessageMetadata | undefined {
  if (!metadata) return undefined;
  if (typeof metadata === "string") {
    const trimmed = metadata.trim();
    if (!trimmed || trimmed === "{}") return undefined;
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (typeof parsed === "object" && parsed !== null) {
        return parsed as ChatMessageMetadata;
      }
      return undefined;
    } catch {
      return undefined;
    }
  }
  return metadata;
}

export function normalizeChatMessage(msg: ChatMessage): ChatMessage {
  const metadata = normalizeMessageMetadata(
    msg.metadata as ChatMessageMetadata | string | undefined
  );
  return metadata ? { ...msg, metadata } : { ...msg, metadata: undefined };
}

export function normalizeChatMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map(normalizeChatMessage);
}

/** 按 id 合并消息；用户/助手消息可替换 temp-* 占位行。 */
export function upsertChatMessage(
  prev: ChatMessage[],
  msg: ChatMessage
): ChatMessage[] {
  const normalized = normalizeChatMessage(msg);
  const idx = prev.findIndex((m) => m.id === normalized.id);
  if (idx >= 0) {
    const updated = [...prev];
    updated[idx] = { ...updated[idx], ...normalized };
    return updated;
  }
  if (normalized.role === "user" || normalized.role === "assistant") {
    const tempIdx = prev.findIndex(
      (m) => m.role === normalized.role && isEphemeralMessageId(m.id)
    );
    if (tempIdx >= 0) {
      const updated = [...prev];
      updated[tempIdx] = normalized;
      return updated;
    }
  }
  return [...prev, normalized];
}
