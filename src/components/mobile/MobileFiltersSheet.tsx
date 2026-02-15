"use client";

import type { ReactNode } from "react";
import { FiltersSheet } from "@/components/admin/filters-sheet";

type MobileFiltersSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  onApply: () => void;
  onReset: () => void;
  children: ReactNode;
};

export function MobileFiltersSheet({
  open,
  onOpenChange,
  title = "Bộ lọc",
  onApply,
  onReset,
  children,
}: MobileFiltersSheetProps) {
  return (
    <FiltersSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      onApply={onApply}
      onClear={onReset}
    >
      {children}
    </FiltersSheet>
  );
}
