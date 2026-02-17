"use client";

import type { ReactNode } from "react";
import { UI_TEXT } from "@/lib/ui-text.vi";

type MobileTopbarProps = {
  title: string;
  subtitle?: string;
  onOpenMenu?: () => void;
  rightAction?: ReactNode;
};

export function MobileTopbar({ title, subtitle, onOpenMenu, rightAction }: MobileTopbarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-white/90 backdrop-blur lg:hidden">
      <div className="mx-auto flex h-14 max-w-[420px] items-center justify-between px-3">
        {onOpenMenu ? (
          <button
            type="button"
            onClick={onOpenMenu}
            className="tap-feedback inline-flex h-10 items-center rounded-xl border border-zinc-200 bg-white/85 px-3 text-sm font-medium text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            aria-label="Mở menu"
          >
            {UI_TEXT.common.menu}
          </button>
        ) : (
          <div className="h-10 min-w-[72px]" />
        )}
        <div className="min-w-0 px-2 text-center">
          <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
          {subtitle ? <p className="truncate text-[11px] text-zinc-500">{subtitle}</p> : null}
        </div>
        <div className="min-w-[72px] shrink-0 text-right">{rightAction}</div>
      </div>
    </header>
  );
}
