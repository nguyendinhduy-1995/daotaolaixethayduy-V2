"use client";

import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
};

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "border border-slate-900 bg-slate-900 text-white hover:bg-slate-800 hover:border-slate-800 focus-visible:ring-slate-300",
  secondary:
    "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100 focus-visible:ring-zinc-200",
  danger: "border border-red-700 bg-red-700 text-white hover:bg-red-600 hover:border-red-600 focus-visible:ring-red-200",
  ghost: "border border-transparent bg-transparent text-zinc-700 hover:bg-zinc-100 focus-visible:ring-zinc-200",
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-xl px-3.5 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
