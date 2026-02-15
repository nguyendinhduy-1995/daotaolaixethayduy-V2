"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type QuickSearchRowProps = {
  value: string;
  onChange: (value: string) => void;
  onOpenFilter: () => void;
  activeFilterCount?: number;
  placeholder?: string;
  quickActions?: ReactNode;
};

export function QuickSearchRow({
  value,
  onChange,
  onOpenFilter,
  activeFilterCount = 0,
  placeholder = "Tìm kiếm",
  quickActions,
}: QuickSearchRowProps) {
  return (
    <div className="space-y-2 md:hidden">
      <div className="surface flex items-center gap-2 p-2 transition-shadow duration-200">
        <Input
          className="min-h-11"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <Button variant="secondary" className="min-h-11 shrink-0" onClick={onOpenFilter}>
          Bộ lọc{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </Button>
      </div>
      {quickActions ? <div className="flex gap-2 overflow-x-auto pb-1">{quickActions}</div> : null}
    </div>
  );
}
