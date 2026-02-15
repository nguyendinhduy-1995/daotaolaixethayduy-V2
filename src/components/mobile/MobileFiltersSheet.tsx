"use client";

import type { ReactNode } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";

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
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      footer={
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => {
              onReset();
              onOpenChange(false);
            }}
          >
            Xóa lọc
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              onApply();
              onOpenChange(false);
            }}
          >
            Áp dụng
          </Button>
        </div>
      }
    >
      {children}
    </BottomSheet>
  );
}
