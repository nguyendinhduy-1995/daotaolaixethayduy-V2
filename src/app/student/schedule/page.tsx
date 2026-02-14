"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Table } from "@/components/ui/table";
import { formatDateVi, formatTimeHm } from "@/lib/date-utils";

type ScheduleItem = { id: string; title: string; type: string; startAt: string; endAt: string | null };

export default function StudentSchedulePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState<ScheduleItem[]>([]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/student/me", { credentials: "include" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 401) router.replace("/student/login");
        else setError(body?.error?.message || "Không tải được lịch học");
        setLoading(false);
        return;
      }
      setItems(body.schedule || []);
      setLoading(false);
    })();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-zinc-700">
        <Spinner /> Đang tải...
      </div>
    );
  }
  if (error) return <Alert type="error" message={error} />;

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold text-zinc-900">Lịch học của bạn</h1>
      {items.length === 0 ? (
        <div className="rounded-xl bg-white p-6 text-sm text-zinc-600 shadow-sm">Chưa có lịch học sắp tới.</div>
      ) : (
        <Table headers={["Ngày", "Giờ", "Nội dung", "Loại"]}>
          {items.map((item) => (
            <tr key={item.id} className="border-t border-zinc-100">
              <td className="px-3 py-2 text-sm text-zinc-700">{formatDateVi(item.startAt)}</td>
              <td className="px-3 py-2 text-sm text-zinc-700">
                {formatTimeHm(item.startAt)}
                {item.endAt ? ` - ${formatTimeHm(item.endAt)}` : ""}
              </td>
              <td className="px-3 py-2 text-sm text-zinc-700">{item.title}</td>
              <td className="px-3 py-2 text-sm text-zinc-700">{item.type}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
