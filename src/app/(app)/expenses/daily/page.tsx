"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { getToken } from "@/lib/auth-client";
import { todayInHoChiMinh, formatCurrencyVnd } from "@/lib/date-utils";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { SectionCard } from "@/components/ui/section-card";

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
  const [dateKey, setDateKey] = useState(todayInHoChiMinh());
  const [items, setItems] = useState<DailyItem[]>([]);
  const [branchId, setBranchId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const totalVnd = useMemo(() => items.reduce((sum, item) => sum + (item.amountVnd || 0), 0), [items]);

  const loadData = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError("");
    setSuccess("");
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
    setSuccess("");
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
      setSuccess("Đã lưu chi phí trong ngày.");
    } catch (e) {
      const err = e as ApiClientError;
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 pb-20 md:pb-4">
      <SectionCard
        title="Chi phí theo ngày"
        subtitle="Nhập chi phí vận hành theo danh mục của chi nhánh."
        rightAction={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/expenses/monthly?month=${toMonthKey(dateKey)}`}
              className="inline-flex h-10 items-center rounded-xl border border-zinc-300 px-3 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              Xem tổng hợp tháng
            </Link>
            <Button onClick={saveData} disabled={saving || loading}>
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner /> Đang lưu...
                </span>
              ) : (
                "Lưu chi phí"
              )}
            </Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
          <div>
            <label className="mb-1 block text-sm text-zinc-700">Ngày</label>
            <Input type="date" value={dateKey} onChange={(e) => setDateKey(e.target.value)} />
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Tổng chi phí ngày</p>
            <p className="text-xl font-semibold text-zinc-900">{formatCurrencyVnd(totalVnd)}</p>
          </div>
        </div>
      </SectionCard>

      {error ? <Alert type="error" message={error} /> : null}
      {success ? <Alert type="success" message={success} /> : null}

      {loading ? (
        <div className="flex items-center gap-2 text-zinc-700">
          <Spinner /> Đang tải dữ liệu...
        </div>
      ) : (
        <SectionCard title="Danh mục chi phí">
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={item.categoryId} className="grid gap-2 rounded-xl border border-zinc-200 bg-white p-3 md:grid-cols-[1fr_180px_1fr]">
                <div>
                  <p className="text-sm font-medium text-zinc-900">{item.categoryName}</p>
                </div>
                <Input
                  type="number"
                  min={0}
                  value={item.amountVnd}
                  onChange={(e) => {
                    const value = Number(e.target.value || 0);
                    setItems((prev) => prev.map((row, i) => (i === idx ? { ...row, amountVnd: value } : row)));
                  }}
                />
                <Input
                  value={item.note}
                  placeholder="Ghi chú (tuỳ chọn)"
                  onChange={(e) => {
                    const value = e.target.value;
                    setItems((prev) => prev.map((row, i) => (i === idx ? { ...row, note: value } : row)));
                  }}
                />
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
