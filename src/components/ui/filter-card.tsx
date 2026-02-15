"use client";

import type { ReactNode } from "react";

type FilterCardProps = {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function FilterCard({ title = "Bộ lọc", actions, children }: FilterCardProps) {
  return (
    <section className="rounded-[16px] border border-[var(--border)] bg-white p-4 shadow-sm md:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">{title}</h2>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}
