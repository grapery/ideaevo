"use client";

import { useState } from "react";
import Link from "next/link";
import { agentApi } from "@/lib/api-client";
import { useApiKey } from "@/lib/api-key-context";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import { Modal } from "@/components/ui/modal";

type Props = {
  agentId: string;
  agentName: string;
  compact?: boolean;
};

export function AgentApiKeyPanel({ agentId, agentName, compact = false }: Props) {
  const { apiKey, setApiKey, agentId: boundAgentId } = useApiKey();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const isBound = boundAgentId === agentId && !!apiKey;

  async function handleRotate() {
    setLoading(true);
    try {
      const res = await agentApi.rotateApiKey(agentId);
      setRevealedKey(res.api_key);
      setShowKey(true);
      setConfirmOpen(false);
      notify.success("API Key 已重新生成");
    } catch (err) {
      notify.error(getErrorMessage(err, "重新生成失败"));
    } finally {
      setLoading(false);
    }
  }

  function handleUseInBrowser() {
    if (!revealedKey) return;
    setApiKey(revealedKey);
    notify.success(`已将 ${agentName} 设为浏览器默认 Key`);
  }

  if (compact) {
    return (
      <>
        <button
          type="button"
          className="text-xs text-[var(--primary)] hover:underline"
          onClick={() => setConfirmOpen(true)}
        >
          API Key
        </button>
        {renderModals()}
      </>
    );
  }

  return (
    <div className="border-t border-[var(--divider)] pt-4 space-y-3">
      <div>
        <h4 className="text-sm font-medium text-[var(--ink)]">API Key</h4>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          用于 MCP / REST 以该 Agent 身份调用。Key 仅在注册或重新生成时显示一次，请妥善保存。
        </p>
      </div>

      {revealedKey ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type={showKey ? "text" : "password"}
              readOnly
              value={revealedKey}
              className="flex-1 border border-[var(--rule)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-mono"
            />
            <button type="button" className="btn-outline btn-sm" onClick={() => setShowKey((v) => !v)}>
              {showKey ? "隐藏" : "显示"}
            </button>
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={() => {
                navigator.clipboard?.writeText(revealedKey);
                notify.success("已复制");
              }}
            >
              复制
            </button>
          </div>
          {!isBound && (
            <button type="button" className="btn-default btn-sm" onClick={handleUseInBrowser}>
              设为浏览器默认 Key
            </button>
          )}
          {isBound && (
            <p className="text-xs text-[var(--text-muted)]">已是当前浏览器绑定的 Agent Key</p>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-outline btn-sm" onClick={() => setConfirmOpen(true)}>
            重新生成 API Key
          </button>
          {isBound && (
            <span className="text-xs text-[var(--text-muted)]">浏览器已绑定此 Agent 的 Key</span>
          )}
        </div>
      )}

      <p className="text-xs text-[var(--text-muted)]">
        MCP 配置见 <Link href="/docs/mcp" className="text-[var(--primary)] hover:underline">文档</Link>
      </p>

      {renderModals()}
    </div>
  );

  function renderModals() {
    return (
      <Modal
        open={confirmOpen}
        onClose={() => !loading && setConfirmOpen(false)}
        title="重新生成 API Key"
        description="旧 Key 将立即失效。使用旧 Key 的 MCP 客户端需更新配置。"
        footer={
          <>
            <button
              type="button"
              className="btn-outline px-4 py-2 text-sm"
              disabled={loading}
              onClick={() => setConfirmOpen(false)}
            >
              取消
            </button>
            <button
              type="button"
              className="btn-default px-4 py-2 text-sm disabled:opacity-50"
              disabled={loading}
              onClick={() => void handleRotate()}
            >
              {loading ? "生成中…" : "确认重新生成"}
            </button>
          </>
        }
      >
        <p className="text-sm text-[var(--text-muted)]">
          Agent：<span className="font-medium text-[var(--ink)]">{agentName}</span>
        </p>
      </Modal>
    );
  }
}
