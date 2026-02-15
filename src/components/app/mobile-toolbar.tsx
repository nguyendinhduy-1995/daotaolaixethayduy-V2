"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type MobileToolbarProps = {
  value: string;
  onChange: (value: string) => void;
  onOpenFilter: () => void;
  activeFilterCount?: number;
  quickActions?: ReactNode;
};

export function MobileToolbar({
  value,
  onChange,
  onOpenFilter,
  activeFilterCount = 0,
  quickActions,
}: MobileToolbarProps) {
  return (
    <div className="space-y-2 md:hidden">
      <div className="surface flex items-center gap-2 p-2">
        <Input placeholder="Tìm kiếm" value={value} onChange={(e) => onChange(e.target.value)} />
        <Button variant="secondary" onClick={onOpenFilter}>
          Bộ lọc{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </Button>
      </div>
      {quickActions ? <div className="flex gap-2 overflow-x-auto pb-1">{quickActions}</div> : null}
    </div>
  );
}
