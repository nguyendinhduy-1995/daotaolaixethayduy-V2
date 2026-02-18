"use client";

import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "accent";
};

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "border border-slate-900 bg-slate-900 text-white hover:bg-slate-800 hover:border-slate-800 focus-visible:ring-[var(--ring)] active:scale-[0.98]",
  secondary:
    "border border-[var(--border)] bg-white text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 focus-visible:ring-[var(--ring)] active:scale-[0.98]",
  danger:
    "border border-red-600 bg-red-600 text-white hover:bg-red-500 hover:border-red-500 focus-visible:ring-red-200 active:scale-[0.98]",
  ghost:
    "border border-transparent bg-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-[var(--ring)] active:scale-[0.98]",
  accent:
    "border-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 hover:brightness-110 focus-visible:ring-blue-300 active:scale-[0.97]",
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex h-11 items-center justify-center rounded-[12px] px-4 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
