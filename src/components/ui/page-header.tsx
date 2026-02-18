"use client";

import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  icon?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, subtitle, icon, actions }: PageHeaderProps) {
  return (
    <header className="animate-fadeInUp relative overflow-hidden rounded-[16px] border border-zinc-200/60 bg-white px-5 py-5 shadow-sm md:px-6">
      <div className="absolute inset-y-0 left-0 w-1 rounded-l-[16px] bg-gradient-to-b from-blue-500 to-indigo-600" />
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 pl-1">
          <h1 className="flex items-center gap-2.5 truncate text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
            {icon ? <span className="text-2xl">{icon}</span> : null}
            {title}
          </h1>
          {subtitle ? <p className="mt-1.5 text-sm text-zinc-500">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
