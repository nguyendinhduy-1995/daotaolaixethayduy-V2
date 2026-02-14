"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrencyVnd } from "@/lib/date-utils";

type FinanceData = {
  finance: { totalTuition: number; paid: number; remaining: number; paid50: boolean };
  tuitionPlan: { province: string; licenseType: string; tuition: number } | null;
};

export default function StudentFinancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<FinanceData | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/student/me", { credentials: "include" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 401) router.replace("/student/login");
        else setError(body?.error?.message || "Không tải được tài chính");
        setLoading(false);
        return;
      }
      setData(body);
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
  if (!data) return <Alert type="error" message={error || "Không có dữ liệu"} />;

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold text-zinc-900">Tài chính học viên</h1>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-500">Tổng học phí</p>
          <p className="text-lg font-semibold text-zinc-900">{formatCurrencyVnd(data.finance.totalTuition)}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-500">Đã thanh toán</p>
          <p className="text-lg font-semibold text-zinc-900">{formatCurrencyVnd(data.finance.paid)}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-500">Còn lại</p>
          <p className="text-lg font-semibold text-zinc-900">{formatCurrencyVnd(data.finance.remaining)}</p>
        </div>
      </div>
      <div className="rounded-xl bg-white p-4 shadow-sm text-sm text-zinc-700">
        <p>Mốc 50%: {data.finance.paid50 ? "Đã đạt" : "Chưa đạt"}</p>
        <p>Bảng học phí: {data.tuitionPlan ? `${data.tuitionPlan.province} - ${data.tuitionPlan.licenseType}` : "Chưa có"}</p>
      </div>
    </div>
  );
}
