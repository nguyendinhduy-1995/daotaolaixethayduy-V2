"use client";

import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-sm md:flex-row md:items-center md:justify-between md:px-5">
      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold text-slate-900 md:text-xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-zinc-600">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
