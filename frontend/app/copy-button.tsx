"use client";

import { useState } from "react";
import { DeimosIcon } from "@/components/deimos-icon";
import { useI18n } from "@/lib/i18n/provider";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const { t } = useI18n();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="ml-auto p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
      aria-label={t("chat.copy")}
    >
      <DeimosIcon
        name={copied ? "check" : "copy"}
        className={`h-5 w-5 ${copied ? "text-emerald-400" : ""}`}
      />
    </button>
  );
}
