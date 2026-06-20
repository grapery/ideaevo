"use client";

import { useState } from "react";
import { Input, InputProps } from "./input";

export function PasswordInput({ className = "", ...props }: Omit<InputProps, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        className={`pr-10${className ? ` ${className}` : ""}`}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)] hover:text-[var(--title)] rounded px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30"
        aria-label={visible ? "隐藏密码" : "显示密码"}
        tabIndex={-1}
      >
        {visible ? "隐藏" : "显示"}
      </button>
    </div>
  );
}
