"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getErrorMessage } from "@/lib/api-error";
import {
  IDEA_AUTH_REQUIRED_MSG,
  ideaRequestJson,
} from "@/lib/idea-request";
import { useIdeaActionAuth } from "@/lib/use-idea-action-auth";
import { Modal } from "@/components/ui/modal";
import { FormField, ButtonSpinner } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { notify } from "@/components/ui/notify";
import { IconGitFork } from "./icons";

type ForkIdeaDialogProps = {
  open: boolean;
  onClose: () => void;
  ideaId: string;
  /** 被 fork 的原想法标题，用于上下文展示与预填。 */
  sourceTitle: string;
};

const TITLE_MAX = 120;

function validateTitle(v: string): string {
  const t = v.trim();
  if (!t) return "请为新想法填写标题";
  if (t.length > TITLE_MAX) return `标题最多 ${TITLE_MAX} 字，当前 ${t.length} 字`;
  return "";
}

export function ForkIdeaDialog({
  open,
  onClose,
  ideaId,
  sourceTitle,
}: ForkIdeaDialogProps) {
  const { apiKey, canAct, useSession } = useIdeaActionAuth();
  const router = useRouter();

  const defaultTitle = `${sourceTitle} (Fork)`;
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{
    title?: string;
    description?: string;
    reason?: string;
    form?: string;
  }>({});
  const [loading, setLoading] = useState(false);

  // 打开时重置表单。
  useEffect(() => {
    if (open) {
      setTitle(defaultTitle);
      setDescription("");
      setReason("");
      setErrors({});
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ideaId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canAct) {
      setErrors({ form: IDEA_AUTH_REQUIRED_MSG });
      return;
    }

    const titleErr = validateTitle(title);
    const descErr = description.trim() ? "" : "请填写新想法的描述";
    const reasonErr = reason.trim() ? "" : "请说明你 fork 这个想法的原因";
    const nextErrors = {
      title: titleErr || undefined,
      description: descErr || undefined,
      reason: reasonErr || undefined,
    };
    setErrors(nextErrors);
    if (titleErr || descErr || reasonErr) return;

    setLoading(true);
    try {
      const data = await ideaRequestJson<{ id: string }>(
        `/ideas/${ideaId}/fork`,
        {
          method: "POST",
          apiKey: useSession ? undefined : apiKey,
          useSession,
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            reason: reason.trim(),
          }),
        }
      );
      notify.success("已基于该想法创建你的新想法", {
        action: {
          label: "前往查看",
          onClick: () => router.push(`/ideas/${data.id}`),
        },
      });
      onClose();
      // 刷新以更新 fork 计数 / fork 树。
      router.refresh();
    } catch (err) {
      const msg = getErrorMessage(err, "Fork 失败");
      // 重复 fork 等服务端错误归到表单级提示。
      setErrors({ form: msg });
    } finally {
      setLoading(false);
    }
  }

  const footer = (
    <>
      <button
        type="button"
        onClick={onClose}
        disabled={loading}
        className="btn-outline px-4 py-2 text-sm disabled:opacity-50"
      >
        取消
      </button>
      <button
        type="submit"
        form="fork-idea-form"
        disabled={loading}
        className="inline-flex items-center gap-2 gradient-btn px-5 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <ButtonSpinner className="h-4 w-4" />
            Fork 中…
          </>
        ) : (
          <>
            <IconGitFork className="h-4 w-4" />
            确认 Fork
          </>
        )}
      </button>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      disableClose={loading}
      title={
        <span className="inline-flex items-center gap-2">
          <IconGitFork className="h-5 w-5 text-[var(--primary)]" />
          Fork 这个想法
        </span>
      }
      description="基于这个想法创建属于你的新想法，可以自由修改。"
      footer={footer}
    >
      {/* 原想法上下文 */}
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-[var(--divider)] bg-[var(--bg-subtle)] px-4 py-3">
        <IconGitFork className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)]" />
        <div className="min-w-0">
          <div className="text-xs text-[var(--text-muted)]">将基于此想法创建 Fork</div>
          <div className="mt-0.5 line-clamp-2 text-sm font-medium text-[var(--title)]">
            {sourceTitle}
          </div>
        </div>
      </div>

      <form id="fork-idea-form" onSubmit={handleSubmit} className="space-y-4">
        <FormField
          id="fork-title"
          label="标题"
          required
          error={errors.title}
          hint={`${title.length}/${TITLE_MAX}`}
        >
          <Input
            id="fork-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (errors.title) setErrors((p) => ({ ...p, title: undefined }));
            }}
            hasError={!!errors.title}
            placeholder="给新想法起一个清晰的标题"
            maxLength={TITLE_MAX}
          />
        </FormField>

        <FormField
          id="fork-description"
          label="描述"
          required
          error={errors.description}
        >
          <Textarea
            id="fork-description"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (errors.description)
                setErrors((p) => ({ ...p, description: undefined }));
            }}
            hasError={!!errors.description}
            placeholder="详细说明这个新想法的内容、目标或要解决的问题…"
            rows={4}
          />
        </FormField>

        <FormField
          id="fork-reason"
          label="Fork 原因"
          required
          error={errors.reason}
          hint="会记录在 fork 关系中，便于追溯演变"
        >
          <Textarea
            id="fork-reason"
            variant="subtle"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (errors.reason)
                setErrors((p) => ({ ...p, reason: undefined }));
            }}
            hasError={!!errors.reason}
            placeholder="例如：想在原想法基础上增加 XX 功能 / 调整实现方向…"
            rows={3}
          />
        </FormField>

        {errors.form && (
          <div
            role="alert"
            className="field-shake flex items-start gap-2.5 rounded-xl border border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-2.5 text-sm text-[var(--coral)]"
          >
            <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <span>{errors.form}</span>
          </div>
        )}
      </form>
    </Modal>
  );
}
