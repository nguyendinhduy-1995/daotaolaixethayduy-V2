"use client";

type BadgeProps = {
  text: string;
  tone?: "neutral" | "primary" | "accent" | "success" | "danger";
};

const toneClasses: Record<NonNullable<BadgeProps["tone"]>, string> = {
  neutral: "border-zinc-300 bg-zinc-100 text-zinc-700",
  primary: "border-slate-300 bg-slate-100 text-slate-800",
  accent: "border-amber-300 bg-amber-100 text-amber-800",
  success: "border-emerald-300 bg-emerald-100 text-emerald-800",
  danger: "border-rose-300 bg-rose-100 text-rose-800",
};

export function Badge({ text, tone = "neutral" }: BadgeProps) {
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneClasses[tone]}`}>{text}</span>;
}
