"use client";

import { useEffect, useState } from "react";
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
  /** Server-reported key status; defaults to active when omitted. */
  apiKeyStatus?: "active" | "revoked" | string;
  compact?: boolean;
  onStatusChange?: (status: "active" | "revoked") => void;
};

type ConfirmAction = "create" | "regenerate" | "revoke" | null;

export function AgentApiKeyPanel({
  agentId,
  agentName,
  apiKeyStatus: initialStatus = "active",
  compact = false,
  onStatusChange,
}: Props) {
  const { apiKey, setApiKey, agentId: boundAgentId } = useApiKey();
  const { t } = useI18n();
  const [status, setStatus] = useState(initialStatus || "active");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    setStatus(initialStatus || "active");
  }, [initialStatus]);

  const isBound = boundAgentId === agentId && !!apiKey;
  const isRevoked = status === "revoked";

  async function handleRotate(kind: "create" | "regenerate") {
    setLoading(true);
    try {
      const res = await agentApi.rotateApiKey(agentId);
      setRevealedKey(res.api_key);
      setShowKey(true);
      setStatus("active");
      onStatusChange?.("active");
      setConfirmAction(null);
      // 若浏览器正绑定此 Agent，自动换上新 Key，避免旧 Key 失效后仍残留。
      if (boundAgentId === agentId) {
        setApiKey(res.api_key);
      }
      notify.success(
        kind === "create" ? t("agentKey.created") : t("agentKey.regenerated"),
      );
    } catch (err) {
      notify.error(getErrorMessage(err, t("common.operationFailed")));
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke() {
    setLoading(true);
    try {
      await agentApi.revokeApiKey(agentId);
      setRevealedKey(null);
      setShowKey(false);
      setStatus("revoked");
      onStatusChange?.("revoked");
      setConfirmAction(null);
      if (boundAgentId === agentId) {
        setApiKey("");
      }
      notify.success(t("agentKey.revoked"));
    } catch (err) {
      notify.error(getErrorMessage(err, t("common.operationFailed")));
    } finally {
      setLoading(false);
    }
  }

  function handleUseInBrowser() {
    if (!revealedKey) return;
    setApiKey(revealedKey);
    notify.success(t("agentKey.setDefault", { name: agentName }));
  }

  if (compact) {
    return (
      <>
        <button
          type="button"
          className="text-xs text-[var(--primary)] hover:underline"
          onClick={() => setConfirmAction(isRevoked ? "create" : "regenerate")}
        >
          {t("agentKey.title")}
        </button>
        {renderModals()}
      </>
    );
  }

  return (
    <div className="border-t border-[var(--divider)] pt-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-medium text-[var(--ink)]">{t("agentKey.title")}</h4>
          <p className="text-xs text-[var(--text-muted)] mt-1">{t("agentKey.hint")}</p>
        </div>
        <span
          className={`badge-pill ${isRevoked ? "badge-muted" : "badge-active"}`}
        >
          {isRevoked ? t("agentKey.statusRevoked") : t("agentKey.statusActive")}
        </span>
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
              {t("agentKey.setAsDefault")}
            </button>
          )}
          {isBound && (
            <p className="text-xs text-[var(--text-muted)]">{t("agentKey.currentlyBound")}</p>
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {isRevoked ? (
          <button
            type="button"
            className="btn-outline btn-sm"
            onClick={() => setConfirmAction("create")}
          >
            {t("agentKey.create")}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={() => setConfirmAction("regenerate")}
            >
              {t("agentKey.regenerate")}
            </button>
            <button
              type="button"
              className="btn-danger btn-sm"
              onClick={() => setConfirmAction("revoke")}
            >
              {t("agentKey.revoke")}
            </button>
          </>
        )}
        {isBound && !isRevoked && (
          <span className="text-xs text-[var(--text-muted)]">{t("agentKey.alreadyBound")}</span>
        )}
      </div>

      <p className="text-xs text-[var(--text-muted)]">
        {t("agentKey.docsPrefix")}{" "}
        <Link href="/docs/mcp" className="text-[var(--primary)] hover:underline">
          {t("settings.docsLink")}
        </Link>
      </p>

      {renderModals()}
    </div>
  );

  function renderModals() {
    const isRevoke = confirmAction === "revoke";
    const isCreate = confirmAction === "create";
    return (
      <Modal
        open={confirmAction != null}
        onClose={() => !loading && setConfirmAction(null)}
        title={
          isRevoke
            ? t("agentKey.revoke")
            : isCreate
              ? t("agentKey.create")
              : t("agentKey.regenerate")
        }
        description={
          isRevoke
            ? t("agentKey.revokeDesc")
            : isCreate
              ? t("agentKey.createDesc")
              : t("agentKey.regenDesc")
        }
        footer={
          <>
            <button
              type="button"
              className="btn-outline px-4 py-2 text-sm"
              disabled={loading}
              onClick={() => setConfirmAction(null)}
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className={`px-4 py-2 text-sm disabled:opacity-50 ${isRevoke ? "btn-danger" : "btn-default"}`}
              disabled={loading}
              onClick={() => {
                if (isRevoke) void handleRevoke();
                else if (isCreate) void handleRotate("create");
                else void handleRotate("regenerate");
              }}
            >
              {loading
                ? t("common.loading")
                : isRevoke
                  ? t("agentKey.confirmRevoke")
                  : isCreate
                    ? t("agentKey.confirmCreate")
                    : t("agentKey.confirmRegen")}
            </button>
          </>
        }
      >
        <p className="text-sm text-[var(--text-muted)]">
          {t("agentKey.agentLabel")}:{" "}
          <span className="font-medium text-[var(--ink)]">{agentName}</span>
        </p>
      </Modal>
    );
  }
}
