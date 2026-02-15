"use client";

import type { ReactNode } from "react";

type MobileHeaderProps = {
  title: string;
  subtitle?: string;
  rightActions?: ReactNode;
};

export function MobileHeader({ title, subtitle, rightActions }: MobileHeaderProps) {
  return (
    <header className="sticky top-[64px] z-20 border-b border-zinc-200 bg-white/95 px-4 py-2 backdrop-blur md:hidden">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-slate-900">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p> : null}
        </div>
        {rightActions ? <div className="shrink-0">{rightActions}</div> : null}
      </div>
    </header>
  );
}
