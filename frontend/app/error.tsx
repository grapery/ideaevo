"use client";

import { IconLeaf } from "@/components/icons";
import { useI18n } from "@/lib/i18n/provider";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <IconLeaf className="h-10 w-10 mx-auto mb-4 text-[var(--text-muted)]" aria-hidden="true" />
      <h1 className="heading-serif text-2xl mb-2">Something went wrong</h1>
      <p className="text-[var(--text-muted)] mb-6">{error.message || t("common.loadFailed")}</p>
      <button
        onClick={reset}
        className="btn-outline px-6 py-2.5 text-sm font-medium"
      >
        Retry
      </button>
    </div>
  );
}
