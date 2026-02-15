"use client";

import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
};

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "border border-slate-900 bg-slate-900 text-white hover:bg-slate-800 hover:border-slate-800 focus-visible:ring-[var(--ring)]",
  secondary:
    "border border-[var(--border)] bg-white text-zinc-800 hover:bg-zinc-100 focus-visible:ring-[var(--ring)]",
  danger: "border border-red-700 bg-red-700 text-white hover:bg-red-600 hover:border-red-600 focus-visible:ring-red-200",
  ghost: "border border-transparent bg-transparent text-zinc-700 hover:bg-zinc-100 focus-visible:ring-[var(--ring)]",
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex h-11 items-center justify-center rounded-[12px] px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
