"use client";

type AlertProps = {
  type?: "error" | "info" | "success";
  message: string;
};

export function Alert({ type = "info", message }: AlertProps) {
  const styles =
    type === "error"
      ? "bg-rose-50 border-rose-200 text-rose-700"
      : type === "success"
        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
        : "bg-slate-50 border-slate-200 text-slate-700";

  return <div className={`rounded-xl border px-3 py-2 text-sm ${styles}`}>{message}</div>;
}
