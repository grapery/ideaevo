export function CodeBlock({ label, children }: { label: string; children: string }) {
  return (
    <div className="code-block">
      <div className="code-block-header">
        <span className="code-block-dot bg-[var(--coral)]" />
        <span className="code-block-dot bg-[var(--accent-amber)]" />
        <span className="code-block-dot bg-[var(--primary)]" />
        <span className="code-block-label">{label}</span>
      </div>
      <pre>{children}</pre>
      <p className="mt-3 text-right text-[10px] text-[#6e6e73] pixel-accent select-none" aria-hidden="true">
        ▪▪▪▪ 🤖
      </p>
    </div>
  );
}
