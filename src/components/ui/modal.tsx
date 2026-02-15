"use client";

import { ReactNode } from "react";
import { Button } from "@/components/ui/button";

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
};

export function Modal({ open, title, description, children, onClose }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 md:items-center md:p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {description ? <p className="mt-1 text-sm text-zinc-600">{description}</p> : null}
          </div>
          <Button variant="ghost" onClick={onClose} aria-label="Đóng cửa sổ">
            Đóng
          </Button>
        </div>
        <div className="max-h-[80vh] overflow-auto p-4">{children}</div>
      </div>
    </div>
  );
}
