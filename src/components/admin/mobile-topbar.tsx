"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

type MobileTopbarProps = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionNode?: ReactNode;
};

export function MobileTopbar({ title, subtitle, actionLabel, onAction, actionNode }: MobileTopbarProps) {
  return (
    <header className="sticky top-[64px] z-20 border-b border-zinc-200/90 bg-white/90 px-4 py-2 backdrop-blur md:hidden">
      <div className="flex min-h-11 items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-slate-900">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p> : null}
        </div>
        {actionNode ? (
          <div className="shrink-0">{actionNode}</div>
        ) : actionLabel && onAction ? (
          <Button className="min-h-11" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </header>
  );
}
