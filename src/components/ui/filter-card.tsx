"use client";

import type { ReactNode } from "react";

type FilterCardProps = {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function FilterCard({ title = "Bộ lọc", actions, children }: FilterCardProps) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-800">{title}</h2>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}
