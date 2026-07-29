"use client";

import { useState } from "react";
import Link from "next/link";
import { agentApi } from "@/lib/api-client";
import { useApiKey } from "@/lib/api-key-context";
import { notify } from "@/components/ui/notify";
import { getErrorMessage } from "@/lib/api-error";
import { Modal } from "@/components/ui/modal";
import { useI18n } from "@/lib/i18n/provider";

type Props = {
  agentId: string;
  agentName: string;
  compact?: boolean;
};

export function AgentApiKeyPanel({ agentId, agentName, compact = false }: Props) {
  const { apiKey, setApiKey, agentId: boundAgentId } = useApiKey();
  const { t } = useI18n();
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
      notify.success("API Key regenerated");
    } catch (err) {
      notify.error(getErrorMessage(err, t("common.operationFailed")));
    } finally {
      setLoading(false);
    }
  }

  function handleUseInBrowser() {
    if (!revealedKey) return;
    setApiKey(revealedKey);
    notify.success(`Set ${agentName} as the browser default key`);
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
          Used to call MCP / REST as this Agent. The key is shown only once on registration or regeneration — keep it safe.
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
              {showKey ? t("settings.hide") : t("settings.show")}
            </button>
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={() => {
                navigator.clipboard?.writeText(revealedKey);
                notify.success(t("chat.copied"));
              }}
            >
              {t("chat.copy")}
            </button>
          </div>
          {!isBound && (
            <button type="button" className="btn-default btn-sm" onClick={handleUseInBrowser}>
              Set as browser default key
            </button>
          )}
          {isBound && (
            <p className="text-xs text-[var(--text-muted)]">This is the currently bound Agent key for the browser</p>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-outline btn-sm" onClick={() => setConfirmOpen(true)}>
            Regenerate API Key
          </button>
          {isBound && (
            <span className="text-xs text-[var(--text-muted)]">This Agent&apos;s key is already bound in the browser</span>
          )}
        </div>
      )}

      <p className="text-xs text-[var(--text-muted)]">
        For MCP configuration see the <Link href="/docs/mcp" className="text-[var(--primary)] hover:underline">docs</Link>
      </p>

      {renderModals()}
    </div>
  );

  function renderModals() {
    return (
      <Modal
        open={confirmOpen}
        onClose={() => !loading && setConfirmOpen(false)}
        title="Regenerate API Key"
        description="The old key will be invalidated immediately. MCP clients using the old key must update their configuration."
        footer={
          <>
            <button
              type="button"
              className="btn-outline px-4 py-2 text-sm"
              disabled={loading}
              onClick={() => setConfirmOpen(false)}
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="btn-default px-4 py-2 text-sm disabled:opacity-50"
              disabled={loading}
              onClick={() => void handleRotate()}
            >
              {loading ? t("common.loading") : "Confirm regenerate"}
            </button>
          </>
        }
      >
        <p className="text-sm text-[var(--text-muted)]">
          Agent: <span className="font-medium text-[var(--ink)]">{agentName}</span>
        </p>
      </Modal>
    );
  }
}
