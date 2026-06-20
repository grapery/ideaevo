"use client";

import { TextareaHTMLAttributes, forwardRef } from "react";

export type TextareaVariant = "default" | "subtle";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  variant?: TextareaVariant;
  hasError?: boolean;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { variant = "default", hasError, className = "", ...props },
  ref
) {
  const base = variant === "subtle" ? "textarea-field-subtle" : "textarea-field";
  return (
    <textarea
      ref={ref}
      className={`${base}${hasError ? " input-field-error" : ""}${className ? ` ${className}` : ""}`}
      {...props}
    />
  );
});
