"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getErrorMessage } from "@/lib/api-error";
import { ideaRequestJson } from "@/lib/idea-request";
import { useIdeaActionAuth } from "@/lib/use-idea-action-auth";
import { Modal } from "@/components/ui/modal";
import { FormField, ButtonSpinner } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { notify } from "@/components/ui/notify";
import { DeimosIcon } from "@/components/deimos-icon";
import { IconGitFork } from "./icons";
import { useI18n } from "@/lib/i18n/provider";

type ForkIdeaDialogProps = {
  open: boolean;
  onClose: () => void;
  ideaId: string;
  /** 被 fork 的原想法标题，用于上下文展示与预填。 */
  sourceTitle: string;
  /** 被 fork 的原想法描述,默认继承到新分支(降低变异摩擦)。 */
  sourceDescription?: string;
};

const TITLE_MAX = 120;

export function ForkIdeaDialog(props: ForkIdeaDialogProps) {
  if (!props.open) return null;
  return <ForkIdeaDialogContent key={props.ideaId} {...props} />;
}

function ForkIdeaDialogContent({
  open,
  onClose,
  ideaId,
  sourceTitle,
  sourceDescription = "",
}: ForkIdeaDialogProps) {
  const { t } = useI18n();
  const { apiKey, canAct, useSession } = useIdeaActionAuth();
  const router = useRouter();

  const defaultTitle = sourceTitle;
  // 继承父描述:fork = "继承后编辑"而非"从零写起",降低变异摩擦
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(sourceDescription);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{
    title?: string;
    description?: string;
    reason?: string;
    form?: string;
  }>({});
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // AI 生成变异草案:调用 LLM 对父想法进行创造性变异,填充表单
  async function handleGenerate() {
    if (!canAct) {
      setErrors({ form: t("idea.authRequired") });
      return;
    }
    setGenerating(true);
    try {
      const data = await ideaRequestJson<{ title: string; description: string }>(
        `/ideas/${ideaId}/generate-variant`,
        {
          method: "POST",
          apiKey: useSession ? undefined : apiKey,
          useSession,
          body: JSON.stringify({}),
        },
      );
      if (data.title) setTitle(data.title.slice(0, TITLE_MAX));
      if (data.description) setDescription(data.description);
      notify.success(t("fork.variantGenerated"));
    } catch (err) {
      notify.error(getErrorMessage(err, t("fork.variantFailed")));
    } finally {
      setGenerating(false);
    }
  }

  function validateTitle(v: string): string {
    const trimmed = v.trim();
    if (!trimmed) return t("fork.errTitleRequired");
    if (trimmed.length > TITLE_MAX)
      return t("fork.errTitleTooLong", { max: TITLE_MAX, len: trimmed.length });
    return "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canAct) {
      setErrors({ form: t("idea.authRequired") });
      return;
    }

    const titleErr = validateTitle(title);
    const descErr = description.trim() ? "" : t("fork.errDescRequired");
    // reason 改为可选:降低 fork 摩擦,鼓励想法大量变异
    const nextErrors = {
      title: titleErr || undefined,
      description: descErr || undefined,
    };
    setErrors(nextErrors);
    if (titleErr || descErr) return;

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
        },
      );
      notify.success(t("fork.created"), {
        action: {
          label: t("fork.viewIt"),
          onClick: () => router.push(`/ideas/${data.id}`),
        },
      });
      onClose();
      router.refresh();
    } catch (err) {
      const msg = getErrorMessage(err, t("fork.failed"));
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
        className="btn-default px-4 py-2 text-sm disabled:opacity-50"
      >
        {t("fork.cancel")}
      </button>
      <button
        type="submit"
        form="fork-idea-form"
        disabled={loading}
        className="inline-flex items-center gap-2 btn-outline px-5 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <ButtonSpinner className="h-4 w-4" />
            {t("fork.forking")}
          </>
        ) : (
          <>
            <IconGitFork className="h-4 w-4" />
            {t("fork.confirmFork")}
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
          {t("fork.title")}
        </span>
      }
      description={t("fork.desc")}
      footer={footer}
    >
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-[var(--divider)] bg-[var(--bg-subtle)] px-4 py-3">
        <IconGitFork className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)]" />
        <div className="min-w-0">
          <div className="text-xs text-[var(--text-muted)]">
            {t("fork.basedOn")}
          </div>
          <div className="mt-0.5 line-clamp-2 text-sm font-medium text-[var(--title)]">
            {sourceTitle}
          </div>
        </div>
      </div>

      <form id="fork-idea-form" onSubmit={handleSubmit} className="space-y-4">
        {/* AI 变异引擎:一键生成创造性变体,让想法像基因一样低成本裂变 */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-btn)] border border-[var(--primary)]/30 bg-[var(--primary-soft)] px-4 py-2.5 text-[13px] font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary-light)] disabled:opacity-50"
        >
          {generating ? (
            <>
              <ButtonSpinner className="h-4 w-4" />
              {t("fork.generatingVariant")}
            </>
          ) : (
            <>
              <IconGitFork className="h-4 w-4" />
              {t("fork.generateVariant")}
            </>
          )}
        </button>

        <FormField
          id="fork-title"
          label={t("fork.titleLabel")}
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
            placeholder={t("fork.titlePlaceholder")}
            maxLength={TITLE_MAX}
          />
        </FormField>

        <FormField
          id="fork-description"
          label={t("fork.descLabel")}
          required
          error={errors.description}
          hint={sourceDescription ? t("fork.inheritedHint") : undefined}
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
            placeholder={t("fork.descPlaceholder")}
            rows={4}
          />
        </FormField>

        <FormField
          id="fork-reason"
          label={t("fork.reasonLabel")}
          hint={t("fork.reasonHint")}
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
            placeholder={t("fork.reasonPlaceholder")}
            rows={3}
          />
        </FormField>

        {errors.form && (
          <div
            role="alert"
            className="field-shake flex items-start gap-2.5 rounded-xl border border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-2.5 text-sm text-[var(--coral)]"
          >
            <DeimosIcon name="decision" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errors.form}</span>
          </div>
        )}
      </form>
    </Modal>
  );
}
