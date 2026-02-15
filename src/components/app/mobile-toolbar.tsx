"use client";

import type { ReactNode } from "react";
import { QuickSearchRow } from "@/components/admin/quick-search-row";

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
    <QuickSearchRow
      value={value}
      onChange={onChange}
      onOpenFilter={onOpenFilter}
      activeFilterCount={activeFilterCount}
      quickActions={quickActions}
    />
  );
}
