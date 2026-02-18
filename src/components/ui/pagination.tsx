"use client";

import { Button } from "@/components/ui/button";

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (next: number) => void;
};

function pageRange(current: number, totalPages: number): (number | "...")[] {
  const delta = 2;
  const range: (number | "...")[] = [];
  const left = Math.max(2, current - delta);
  const right = Math.min(totalPages - 1, current + delta);

  range.push(1);
  if (left > 2) range.push("...");
  for (let i = left; i <= right; i++) range.push(i);
  if (right < totalPages - 1) range.push("...");
  if (totalPages > 1) range.push(totalPages);
  return range;
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const pages = pageRange(page, totalPages);

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-zinc-500">
        Trang {page}/{totalPages} · {total} bản ghi
      </p>
      <div className="flex items-center gap-1">
        {/* First + Prev */}
        <Button variant="ghost" disabled={page <= 1} onClick={() => onPageChange(1)} className="!h-8 !px-2 text-xs">
          «
        </Button>
        <Button variant="ghost" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="!h-8 !px-2 text-xs">
          ‹
        </Button>

        {/* Page numbers — hidden on very small screens */}
        <div className="hidden items-center gap-0.5 sm:flex">
          {pages.map((p, idx) =>
            p === "..." ? (
              <span key={`dots-${idx}`} className="px-1.5 text-xs text-zinc-400">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={`min-w-[28px] rounded-lg px-1 py-1 text-xs font-medium transition-colors ${p === page
                    ? "bg-gradient-to-b from-amber-400 to-orange-500 text-white shadow-sm"
                    : "text-zinc-600 hover:bg-zinc-100"
                  }`}
              >
                {p}
              </button>
            )
          )}
        </div>

        {/* Mobile: compact indicator */}
        <span className="inline-flex min-w-[56px] items-center justify-center rounded-lg bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700 sm:hidden">
          {page}/{totalPages}
        </span>

        {/* Next + Last */}
        <Button variant="ghost" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className="!h-8 !px-2 text-xs">
          ›
        </Button>
        <Button variant="ghost" disabled={page >= totalPages} onClick={() => onPageChange(totalPages)} className="!h-8 !px-2 text-xs">
          »
        </Button>
      </div>
    </div>
  );
}

