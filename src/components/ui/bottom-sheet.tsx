"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type BottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function BottomSheet({ open, onOpenChange, title, children, footer }: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => panelRef.current?.focus(), 0);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(timer);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-black/30 backdrop-blur-[1px] animate-[fade-in_180ms_ease-out]"
        onClick={() => onOpenChange(false)}
        aria-label="Đóng bộ lọc"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="ios-glass absolute bottom-0 left-0 right-0 rounded-t-[24px] border border-zinc-200 bg-white/85 p-4 pb-[max(env(safe-area-inset-bottom),16px)] shadow-2xl outline-none animate-[sheet-up_220ms_ease-out]"
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-zinc-300" />
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">{title || "Tùy chọn"}</h2>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </div>
        <div className="max-h-[62vh] overflow-auto pb-3">{children}</div>
        {footer ? <div className="sticky bottom-0 border-t border-zinc-200 bg-white pt-3">{footer}</div> : null}
      </div>
    </div>
  );
}
