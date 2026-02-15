"use client";

import type { ReactNode } from "react";

type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  accent?: "navy" | "gold" | "neutral";
  action?: ReactNode;
};

const accentMap: Record<NonNullable<StatCardProps["accent"]>, string> = {
  navy: "border-slate-200",
  gold: "border-amber-200 bg-amber-50/60",
  neutral: "border-zinc-200",
};

export function StatCard({ label, value, hint, accent = "neutral", action }: StatCardProps) {
  return (
    <article className={`rounded-2xl border bg-white p-4 shadow-sm ${accentMap[accent]}`}>
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        {hint ? <p className="text-xs text-zinc-600">{hint}</p> : <span />}
        {action ? <div className="text-xs">{action}</div> : null}
      </div>
    </article>
  );
}
