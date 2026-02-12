"use client";

type AlertProps = {
  type?: "error" | "info" | "success";
  message: string;
};

export function Alert({ type = "info", message }: AlertProps) {
  const styles =
    type === "error"
      ? "bg-red-50 border-red-300 text-red-700"
      : type === "success"
        ? "bg-emerald-50 border-emerald-300 text-emerald-700"
        : "bg-blue-50 border-blue-300 text-blue-700";

  return <div className={`rounded-lg border px-3 py-2 text-sm ${styles}`}>{message}</div>;
}
