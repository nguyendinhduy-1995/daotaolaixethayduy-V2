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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-2 md:items-center md:p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-[20px] border border-[var(--border)] bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3 md:px-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {description ? <p className="mt-1 text-sm text-zinc-600">{description}</p> : null}
          </div>
          <Button variant="ghost" onClick={onClose} aria-label="Đóng cửa sổ">
            Đóng
          </Button>
        </div>
        <div className="max-h-[70vh] overflow-auto p-4 md:max-h-[75vh] md:p-5">{children}</div>
      </div>
    </div>
  );
}
