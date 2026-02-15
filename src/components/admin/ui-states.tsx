"use client";

import type { ReactNode } from "react";
import { Spinner } from "@/components/ui/spinner";

export function LoadingSkeleton({ text = "Đang tải dữ liệu..." }: { text?: string }) {
  return (
    <div className="surface rounded-2xl px-3 py-6 text-center text-sm text-zinc-600 md:hidden">
      <span className="inline-flex items-center gap-2">
        <Spinner /> {text}
      </span>
    </div>
  );
}

export function EmptyState({ text = "Không có dữ liệu", action }: { text?: string; action?: ReactNode }) {
  return (
    <div className="surface rounded-2xl px-3 py-6 text-center text-sm text-zinc-600 md:hidden">
      <p>{text}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ text = "Có lỗi xảy ra", detail }: { text?: string; detail?: string }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700 md:hidden">
      <p className="font-medium">{text}</p>
      {detail ? <p className="mt-1 text-xs">{detail}</p> : null}
    </div>
  );
}
