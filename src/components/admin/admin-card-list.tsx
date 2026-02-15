"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

type AdminCardListProps = {
  children: ReactNode;
};

type AdminCardItemProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  overflowActions?: ReactNode;
  children?: ReactNode;
};

export function AdminCardList({ children }: AdminCardListProps) {
  return <div className="space-y-2 md:hidden">{children}</div>;
}

export function AdminCardItem({
  title,
  subtitle,
  meta,
  primaryAction,
  overflowActions,
  children,
}: AdminCardItemProps) {
  return (
    <article className="surface rounded-2xl p-3 transition duration-200 ease-out hover:-translate-y-[1px] hover:shadow-md active:scale-[0.99]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
          {subtitle ? <p className="mt-0.5 truncate text-xs text-zinc-500">{subtitle}</p> : null}
        </div>
        {overflowActions ? <div className="shrink-0">{overflowActions}</div> : null}
      </div>

      {meta ? <div className="mt-2 text-xs text-zinc-600">{meta}</div> : null}
      {children ? <div className="mt-2">{children}</div> : null}

      {primaryAction ? (
        <div className="mt-3 flex justify-end">
          <Button variant="secondary" className="min-h-11" onClick={primaryAction.onClick}>
            {primaryAction.label}
          </Button>
        </div>
      ) : null}
    </article>
  );
}
