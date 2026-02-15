"use client";

import type { ReactNode } from "react";

type MobileTopbarProps = {
  title: string;
  subtitle?: string;
  onOpenMenu: () => void;
  rightAction?: ReactNode;
};

export function MobileTopbar({ title, subtitle, onOpenMenu, rightAction }: MobileTopbarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-white/90 backdrop-blur lg:hidden">
      <div className="mx-auto flex h-14 max-w-[420px] items-center justify-between px-3">
        <button
          type="button"
          onClick={onOpenMenu}
          className="inline-flex h-10 items-center rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700"
          aria-label="Mở menu"
        >
          Menu
        </button>
        <div className="min-w-0 px-2 text-center">
          <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
          {subtitle ? <p className="truncate text-[11px] text-zinc-500">{subtitle}</p> : null}
        </div>
        <div className="min-w-[72px] shrink-0 text-right">{rightAction}</div>
      </div>
    </header>
  );
}
