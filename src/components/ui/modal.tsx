"use client";

import { ReactNode, useEffect } from "react";
import { Button } from "@/components/ui/button";

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
};

export function Modal({ open, title, description, children, onClose }: ModalProps) {
  /* prevent body scroll when modal is open */
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 md:items-center"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 72px)", paddingTop: "16px", paddingLeft: "8px", paddingRight: "8px" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-[20px] border border-[var(--border)] bg-white shadow-xl md:max-h-[80vh]">
        {/* header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3 md:px-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {description ? <p className="mt-1 text-sm text-zinc-600">{description}</p> : null}
          </div>
          <Button variant="ghost" onClick={onClose} aria-label="Đóng cửa sổ">
            Đóng
          </Button>
        </div>
        {/* scrollable body */}
        <div className="flex-1 overflow-auto p-4 pb-6 md:p-5">{children}</div>
      </div>
    </div>
  );
}
