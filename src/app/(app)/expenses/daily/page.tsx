"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { getToken } from "@/lib/auth-client";
import { todayInHoChiMinh, formatCurrencyVnd } from "@/lib/date-utils";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type DailyItem = {
  categoryId: string;
  categoryName: string;
  amountVnd: number;
  note: string;
};

type DailyResponse = {
  branchId: string;
  dateKey: string;
  items: DailyItem[];
  totalVnd: number;
};

function toMonthKey(dateKey: string) {
  return dateKey.slice(0, 7);
}

export default function ExpensesDailyPage() {
  const toast = useToast();
  const [dateKey, setDateKey] = useState(todayInHoChiMinh());
  const [items, setItems] = useState<DailyItem[]>([]);
  const [branchId, setBranchId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const totalVnd = useMemo(() => items.reduce((sum, item) => sum + (item.amountVnd || 0), 0), [items]);

  const loadData = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson<DailyResponse>(`/api/expenses/daily?date=${dateKey}`, { token });
      setItems(data.items);
      setBranchId(data.branchId);
    } catch (e) {
      const err = e as ApiClientError;
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [dateKey]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function saveData() {
    const token = getToken();
    if (!token) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        dateKey,
        branchId,
        items: items.map((item) => ({
          categoryId: item.categoryId,
          amountVnd: Number(item.amountVnd || 0),
          note: item.note || "",
        })),
      };
      const data = await fetchJson<DailyResponse>("/api/expenses/daily", {
        method: "POST",
        token,
        body: payload,
      });
      setItems(data.items);
      toast.success("Đã lưu chi phí trong ngày.");
    } catch (e) {
      const err = e as ApiClientError;
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 pb-20 md:pb-4">
      {/* ── Premium Header ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 p-4 text-white shadow-lg shadow-emerald-200 animate-fadeInUp">
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/10 blur-xl" />
        <div className="relative flex flex-wrap items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-2xl backdrop-blur-sm">💰</div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">Chi phí theo ngày</h2>
            <p className="text-sm text-white/80">Nhập chi phí vận hành theo danh mục của chi nhánh.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/expenses/monthly?month=${toMonthKey(dateKey)}`} className="inline-flex h-10 items-center rounded-xl bg-white/20 border border-white/30 px-3 text-sm text-white hover:bg-white/30 backdrop-blur-sm transition">📊 Xem tổng hợp tháng</Link>
            <Button onClick={saveData} disabled={saving || loading} className="!bg-white/20 !text-white !border-white/30 hover:!bg-white/30">
              {saving ? "Đang lưu..." : "💾 Lưu chi phí"}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Date picker & total ── */}
      <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm animate-fadeInUp" style={{ animationDelay: "80ms" }}>
        <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
        <div className="grid gap-3 p-4 sm:grid-cols-[220px_1fr]">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-400">📅 Ngày</label>
            <Input type="date" value={dateKey} onChange={(e) => setDateKey(e.target.value)} />
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs uppercase tracking-wide text-emerald-600">Tổng chi phí ngày</p>
            <p className="text-xl font-semibold text-emerald-700">{formatCurrencyVnd(totalVnd)}</p>
          </div>
        </div>
      </div>

      {error ? <Alert type="error" message={error} /> : null}

      {loading ? (
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
              <div className="h-9 w-9 rounded-lg bg-zinc-200" />
              <div className="flex-1 space-y-2"><div className="h-4 w-1/3 rounded bg-zinc-200" /><div className="h-3 w-1/2 rounded bg-zinc-100" /></div>
              <div className="h-8 w-24 rounded bg-zinc-200" />
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm animate-fadeInUp" style={{ animationDelay: "160ms" }}>
          <div className="h-1 bg-gradient-to-r from-emerald-500 to-green-500" />
          <div className="p-4">
            <h3 className="text-sm font-semibold text-zinc-800 mb-2">📋 Danh mục chi phí</h3>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={item.categoryId} className="grid gap-2 rounded-xl border border-zinc-200 bg-white p-3 md:grid-cols-[1fr_180px_1fr] transition-colors hover:bg-zinc-50 animate-fadeInUp" style={{ animationDelay: `${160 + Math.min(idx * 40, 200)}ms` }}>
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{item.categoryName}</p>
                  </div>
                  <Input type="number" min={0} value={item.amountVnd} onChange={(e) => { const value = Number(e.target.value || 0); setItems((prev) => prev.map((row, i) => (i === idx ? { ...row, amountVnd: value } : row))); }} />
                  <Input value={item.note} placeholder="Ghi chú (tuỳ chọn)" onChange={(e) => { const value = e.target.value; setItems((prev) => prev.map((row, i) => (i === idx ? { ...row, note: value } : row))); }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
