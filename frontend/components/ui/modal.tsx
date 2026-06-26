"use client";

import { ReactNode, useCallback, useEffect, useRef } from "react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  /** Accessible label id derived from title when provided; otherwise set explicitly. */
  labelledById?: string;
  children: ReactNode;
  /** Render custom footer (e.g. action buttons). */
  footer?: ReactNode;
  /** Hide the default close (×) button. */
  hideCloseButton?: boolean;
  /** Disable closing on backdrop click / ESC (e.g. during submission). */
  disableClose?: boolean;
  className?: string;
};

const MODAL_TITLE_ID = "modal-title";

export function Modal({
  open,
  onClose,
  title,
  description,
  labelledById,
  children,
  footer,
  hideCloseButton,
  disableClose,
  className = "",
}: ModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    if (!disableClose) onClose();
  }, [disableClose, onClose]);

  // Lock body scroll + ESC close + focus management.
  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = (document.activeElement as HTMLElement) ?? null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    // Focus the first focusable element inside the dialog.
    const card = cardRef.current;
    if (card) {
      const focusable = card.querySelector<HTMLElement>(
        'input, textarea, select, button, a[href], [tabindex]:not([tabindex="-1"])'
      );
      focusable?.focus();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "Tab" && cardRef.current) {
        trapFocus(e, cardRef.current);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, close]);

  if (!open) return null;

  const titleId = labelledById ?? (title ? MODAL_TITLE_ID : undefined);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6"
      role="presentation"
    >
      <div
        className="modal-backdrop fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={close}
        aria-hidden="true"
      />
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`modal-card surface-card-elevated relative z-10 my-auto w-full max-w-md p-6 ${className}`}
      >
        {(title || !hideCloseButton) && (
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              {title && (
                <h2
                  id={MODAL_TITLE_ID}
                  className="heading-serif text-xl leading-snug"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {description}
                </p>
              )}
            </div>
            {!hideCloseButton && (
              <button
                type="button"
                onClick={close}
                disabled={disableClose}
                aria-label="关闭"
                className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--title)] disabled:opacity-40"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        <div>{children}</div>

        {footer && (
          <div className="mt-6 flex items-center justify-end gap-3">{footer}</div>
        )}
      </div>
    </div>
  );
}

/** Keep Tab focus cycling within the dialog. */
function trapFocus(e: KeyboardEvent, container: HTMLElement) {
  const focusables = container.querySelectorAll<HTMLElement>(
    'input, textarea, select, button, a[href], [tabindex]:not([tabindex="-1"])'
  );
  if (focusables.length === 0) return;

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement as HTMLElement;

  if (e.shiftKey && active === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}
