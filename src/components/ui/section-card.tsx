"use client";

import type { ReactNode } from "react";

type SectionCardProps = {
  title?: string;
  subtitle?: string;
  rightAction?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function SectionCard({ title, subtitle, rightAction, children, className = "" }: SectionCardProps) {
  return (
    <section className={`rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:p-5 ${className}`}>
      {title || rightAction ? (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title ? <h2 className="text-base font-semibold text-slate-900">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-sm text-zinc-600">{subtitle}</p> : null}
          </div>
          {rightAction ? <div className="shrink-0">{rightAction}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
