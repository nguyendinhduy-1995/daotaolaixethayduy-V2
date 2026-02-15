"use client";

import { Button } from "@/components/ui/button";

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (next: number) => void;
};

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-zinc-600">
        Trang {page} / {totalPages} - Tổng {total} bản ghi
      </p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Trước
        </Button>
        <Button variant="secondary" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Sau
        </Button>
      </div>
    </div>
  );
}
