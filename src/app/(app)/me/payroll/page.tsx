"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, getToken } from "@/lib/auth-client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      {/* ── Premium Header ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 p-4 text-white shadow-lg shadow-indigo-200 animate-fadeInUp">
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/10 blur-xl" />
        <div className="relative flex flex-wrap items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-2xl backdrop-blur-sm">💵</div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">Phiếu lương của tôi</h2>
            <p className="text-sm text-white/80">Theo dõi thu nhập theo tháng</p>
          </div>
          <div className="flex items-center gap-2">
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-[180px] !bg-white/20 !text-white !border-white/30" />
            <Button variant="secondary" onClick={() => setMonth(currentMonth())} className="!bg-white/20 !text-white !border-white/30 hover:!bg-white/30">Tháng này</Button>
          </div>
        </div>
      </div>

      {error ? <Alert type="error" message={error} /> : null}

      <div className="grid gap-3 md:grid-cols-3 animate-fadeInUp" style={{ animationDelay: "80ms" }}>
        <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm">
          <div className="h-1 bg-gradient-to-r from-emerald-500 to-green-500" />
          <div className="p-4">
            <p className="text-xs uppercase tracking-wide text-emerald-600">💰 Tổng thực nhận</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900">{formatCurrencyVnd(summary.total)}</p>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm">
          <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-500" />
          <div className="p-4">
            <p className="text-xs uppercase tracking-wide text-violet-600">🏆 Hoa hồng</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900">{formatCurrencyVnd(summary.commission)}</p>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm">
          <div className="h-1 bg-gradient-to-r from-blue-500 to-sky-500" />
          <div className="p-4">
            <p className="text-xs uppercase tracking-wide text-blue-600">📄 Số phiếu lương</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900">{summary.count}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
              <div className="h-8 w-8 rounded-lg bg-zinc-200" />
              <div className="flex-1 space-y-2"><div className="h-4 w-1/4 rounded bg-zinc-200" /><div className="h-3 w-1/2 rounded bg-zinc-100" /></div>
              <div className="h-6 w-20 rounded-full bg-zinc-200" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-white p-8 text-center animate-fadeInUp">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-2xl">📭</div>
          <p className="font-medium text-zinc-700">Chưa có phiếu lương</p>
          <p className="mt-1 text-sm text-zinc-500">Chưa có phiếu lương trong tháng đã chọn.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm animate-fadeInUp" style={{ animationDelay: "160ms" }}>
          <Table headers={["Tháng", "Chi nhánh", "Công", "Lương theo công", "Phụ cấp", "Hoa hồng", "Thưởng/Phạt", "Tổng", "Trạng thái"]}>
            {items.map((item, idx) => (
              <tr key={item.id} className="border-t border-zinc-100 transition-colors hover:bg-zinc-50 animate-fadeInUp" style={{ animationDelay: `${160 + Math.min(idx * 40, 300)}ms` }}>
                <td className="px-3 py-2 text-sm text-zinc-700">{item.month}</td>
                <td className="px-3 py-2 text-sm text-zinc-700">{item.branch.name}</td>
                <td className="px-3 py-2 text-sm text-zinc-700">{item.daysWorked} / {item.standardDays}</td>
                <td className="px-3 py-2 text-sm text-zinc-700">{formatCurrencyVnd(item.baseProratedVnd)}</td>
                <td className="px-3 py-2 text-sm text-zinc-700">{formatCurrencyVnd(item.allowanceVnd)}</td>
                <td className="px-3 py-2 text-sm text-zinc-700">{formatCurrencyVnd(item.commissionVnd)}</td>
                <td className="px-3 py-2 text-sm text-zinc-700">{formatCurrencyVnd(item.bonusVnd - item.penaltyVnd)}</td>
                <td className="px-3 py-2 text-sm font-semibold text-zinc-900">{formatCurrencyVnd(item.totalVnd)}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold border ${item.runStatus === "FINAL" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : item.runStatus === "PAID" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                    {item.runStatus === "FINAL" ? "✅ Chốt" : item.runStatus === "PAID" ? "💳 Đã trả" : "📝 Nháp"}
                  </span>
                </td>
              </tr>
            ))}
          </Table>
        </div>
      )}
    </div>
  );
}
