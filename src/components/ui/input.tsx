"use client";

import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = "", ...props }: InputProps) {
  return (
    <input
      className={`h-11 w-full rounded-[12px] border border-[var(--border)] bg-white px-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-slate-400 focus:ring-2 focus:ring-[var(--ring)] ${className}`}
      {...props}
    />
  );
}
