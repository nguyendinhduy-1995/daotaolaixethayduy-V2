"use client";

import { useEffect, useState } from "react";

type AlertProps = {
  type?: "error" | "info" | "success";
  message: string;
  dismissible?: boolean;
  onDismiss?: () => void;
  autoHide?: number; // ms — auto-dismiss after this duration
};

export function Alert({ type = "info", message, dismissible, onDismiss, autoHide }: AlertProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!autoHide) return;
    const timer = window.setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, autoHide);
    return () => window.clearTimeout(timer);
  }, [autoHide, onDismiss]);

  if (!visible) return null;

  const styles =
    type === "error"
      ? "bg-rose-50 border-rose-200 text-rose-700"
      : type === "success"
        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
        : "bg-slate-50 border-slate-200 text-slate-700";

  return (
    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${styles}`}>
      <span className="flex-1">{message}</span>
      {dismissible || onDismiss ? (
        <button
          type="button"
          className="shrink-0 rounded-md px-1 py-0.5 text-xs opacity-60 hover:opacity-100 transition-opacity"
          onClick={() => { setVisible(false); onDismiss?.(); }}
          aria-label="Đóng thông báo"
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}
