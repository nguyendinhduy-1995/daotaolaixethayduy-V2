"use client";

import type { ReactNode } from "react";

type DataCardProps = {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  onClick?: () => void;
};

export function DataCard({ title, subtitle, badge, children, footer, onClick }: DataCardProps) {
  return (
    <article
      className="surface rounded-2xl p-3 transition active:scale-[0.98] md:active:scale-100"
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-900">{title}</h3>
          {subtitle ? <p className="mt-0.5 truncate text-xs text-zinc-500">{subtitle}</p> : null}
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>
      {children ? <div className="mt-2 text-sm text-zinc-700">{children}</div> : null}
      {footer ? <div className="mt-3 flex items-center justify-between gap-2">{footer}</div> : null}
    </article>
  );
}
