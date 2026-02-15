"use client";

import type { SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className = "", children, ...props }: SelectProps) {
  return (
    <select
      className={`w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
