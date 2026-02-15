"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, getToken } from "@/lib/auth-client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Spinner } from "@/components/ui/spinner";
import { Table } from "@/components/ui/table";
import { formatCurrencyVnd } from "@/lib/date-utils";

type PayrollItem = {
  id: string;
  month: string;
  runStatus: "DRAFT" | "FINAL" | "PAID";
  branch: { id: string; name: string };
  baseSalaryVnd: number;
  allowanceVnd: number;
  daysWorked: number;
  standardDays: number;
  baseProratedVnd: number;
  commissionVnd: number;
  penaltyVnd: number;
  bonusVnd: number;
  totalVnd: number;
};

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatApiError(err: ApiClientError) {
  return `${err.code}: ${err.message}`;
}

export default function MePayrollPage() {
  const router = useRouter();
  const [month, setMonth] = useState(currentMonth());
  const [items, setItems] = useState<PayrollItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const summary = useMemo(() => {
    const total = items.reduce((sum, item) => sum + item.totalVnd, 0);
    const commission = items.reduce((sum, item) => sum + item.commissionVnd, 0);
    return { total, commission, count: items.length };
  }, [items]);

  useEffect(() => {
    async function load() {
      const token = getToken();
      if (!token) return;
      setLoading(true);
      setError("");
      try {
        const data = await fetchJson<{ items: PayrollItem[] }>(`/api/me/payroll?month=${month}`, { token });
        setItems(data.items);
      } catch (e) {
        const err = e as ApiClientError;
        if (err.code === "AUTH_MISSING_BEARER" || err.code === "AUTH_INVALID_TOKEN") {
          clearToken();
          router.replace("/login");
          return;
        }
        setError(formatApiError(err));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [month, router]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Phiếu lương của tôi"
        subtitle="Theo dõi thu nhập theo tháng"
        actions={
          <div className="flex items-center gap-2">
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-[180px]" />
            <Button variant="secondary" onClick={() => setMonth(currentMonth())}>Tháng này</Button>
          </div>
        }
      />

      {error ? <Alert type="error" message={error} /> : null}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-[16px] border border-[var(--border)] bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Tổng thực nhận</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{formatCurrencyVnd(summary.total)}</p>
        </div>
        <div className="rounded-[16px] border border-[var(--border)] bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Hoa hồng</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{formatCurrencyVnd(summary.commission)}</p>
        </div>
        <div className="rounded-[16px] border border-[var(--border)] bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Số phiếu lương</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{summary.count}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-zinc-700"><Spinner /> Đang tải dữ liệu...</div>
      ) : items.length === 0 ? (
        <Alert message="Chưa có phiếu lương trong tháng đã chọn." />
      ) : (
        <Table headers={["Tháng", "Chi nhánh", "Công", "Lương theo công", "Phụ cấp", "Hoa hồng", "Thưởng/Phạt", "Tổng", "Trạng thái"]}>
          {items.map((item) => (
            <tr key={item.id} className="border-t border-zinc-100">
              <td className="px-3 py-2 text-sm text-zinc-700">{item.month}</td>
              <td className="px-3 py-2 text-sm text-zinc-700">{item.branch.name}</td>
              <td className="px-3 py-2 text-sm text-zinc-700">{item.daysWorked} / {item.standardDays}</td>
              <td className="px-3 py-2 text-sm text-zinc-700">{formatCurrencyVnd(item.baseProratedVnd)}</td>
              <td className="px-3 py-2 text-sm text-zinc-700">{formatCurrencyVnd(item.allowanceVnd)}</td>
              <td className="px-3 py-2 text-sm text-zinc-700">{formatCurrencyVnd(item.commissionVnd)}</td>
              <td className="px-3 py-2 text-sm text-zinc-700">{formatCurrencyVnd(item.bonusVnd - item.penaltyVnd)}</td>
              <td className="px-3 py-2 text-sm font-semibold text-zinc-900">{formatCurrencyVnd(item.totalVnd)}</td>
              <td className="px-3 py-2 text-sm text-zinc-700">{item.runStatus}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
