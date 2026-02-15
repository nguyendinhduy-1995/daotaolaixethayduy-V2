"use client";

import type { SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className = "", children, ...props }: SelectProps) {
  return (
    <select
      className={`h-11 w-full rounded-[12px] border border-[var(--border)] bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-[var(--ring)] ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
