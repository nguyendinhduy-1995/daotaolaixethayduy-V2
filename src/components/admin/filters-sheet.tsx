"use client";

import type { ReactNode } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";

type FiltersSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  onApply: () => void;
  onClear: () => void;
  onCancel?: () => void;
  children: ReactNode;
};

export function FiltersSheet({
  open,
  onOpenChange,
  title = "Bộ lọc",
  onApply,
  onClear,
  onCancel,
  children,
}: FiltersSheetProps) {
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      footer={
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="ghost"
            className="min-h-11"
            onClick={() => {
              onCancel?.();
              onOpenChange(false);
            }}
          >
            Hủy
          </Button>
          <Button
            variant="secondary"
            className="min-h-11"
            onClick={() => {
              onClear();
            }}
          >
            Xóa lọc
          </Button>
          <Button
            className="min-h-11"
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

