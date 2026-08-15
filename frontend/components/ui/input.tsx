"use client";

import { InputHTMLAttributes, forwardRef } from "react";

export type InputVariant = "default" | "subtle";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  variant?: InputVariant;
  hasError?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { variant = "default", hasError, className = "", ...props },
  ref
) {
  const base = variant === "subtle" ? "input-field-subtle" : "input-field";
  return (
    <input
      ref={ref}
      className={`${base}${hasError ? " input-field-error" : ""}${className ? ` ${className}` : ""}`}
      {...props}
    />
  );
});
