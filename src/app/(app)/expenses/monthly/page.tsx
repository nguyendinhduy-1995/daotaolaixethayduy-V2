"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { fetchMe, getToken, type MeResponse } from "@/lib/auth-client";
import { formatCurrencyVnd, todayInHoChiMinh } from "@/lib/date-utils";
import { hasUiPermission } from "@/lib/ui-permissions";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { SectionCard } from "@/components/ui/section-card";

type SummaryResponse = {
  monthKey: string;
  branchIds: string[];
  totalsByCategory: Array<{ categoryId: string; categoryName: string; totalVnd: number }>;
  expensesTotalVnd: number;
  baseSalaryTotalVnd: number;
  grandTotalVnd: number;
  insights: Array<{ id: string; summary: string; createdAt: string }>;
};

type BaseSalaryResponse = {
  monthKey: string;
  rows: Array<{
    userId: string;
    name: string;
    email: string;
    branchId: string | null;
    baseSalaryVnd: number;
    note: string;
  }>;
  totalVnd: number;
};

function currentMonthKey() {
  return todayInHoChiMinh().slice(0, 7);
}

export default function ExpensesMonthlyPage() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const [monthKey, setMonthKey] = useState(searchParams.get("month") || currentMonthKey());
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [salary, setSalary] = useState<BaseSalaryResponse | null>(null);
  const [user, setUser] = useState<MeResponse["user"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSalary, setShowSalary] = useState(false);
  const [error, setError] = useState("");

  const canEditSalary = hasUiPermission(user?.permissions, "salary", "EDIT");

  const salaryTotal = useMemo(
    () => (salary ? salary.rows.reduce((sum, row) => sum + (row.baseSalaryVnd || 0), 0) : 0),
    [salary]
  );

  const loadData = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [me, summaryRes, salaryRes] = await Promise.all([
        fetchMe(),
        fetchJson<SummaryResponse>(`/api/expenses/summary?month=${monthKey}`, { token }),
        fetchJson<BaseSalaryResponse>(`/api/expenses/base-salary?month=${monthKey}`, { token }),
      ]);
      setUser(me.user);
      setSummary(summaryRes);
      setSalary(salaryRes);
    } catch (e) {
      const err = e as ApiClientError;
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [monthKey]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function saveSalary() {
    if (!salary) return;
    const token = getToken();
    if (!token) return;
    setSaving(true);
    setError("");
    try {
      const data = await fetchJson<BaseSalaryResponse>("/api/expenses/base-salary", {
        method: "POST",
        token,
        body: {
          monthKey,
          items: salary.rows.map((row) => ({
            userId: row.userId,
            baseSalaryVnd: Number(row.baseSalaryVnd || 0),
            note: row.note || "",
          })),
        },
      });
      setSalary(data);
      toast.success("Đã lưu lương cơ bản theo tháng.");
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
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-600 via-orange-600 to-red-500 p-4 text-white shadow-lg shadow-amber-200 animate-fadeInUp">
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/10 blur-xl" />
        <div className="relative flex flex-wrap items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-2xl backdrop-blur-sm">📊</div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">Tổng hợp chi phí tháng</h2>
            <p className="text-sm text-white/80">Theo dõi chi phí vận hành, lương cơ bản và insight theo chi nhánh.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/expenses/daily?date=${monthKey}-01`} className="inline-flex h-10 items-center rounded-xl bg-white/20 border border-white/30 px-3 text-sm text-white hover:bg-white/30 backdrop-blur-sm transition">✏️ Nhập chi phí ngày</Link>
            <Input type="month" value={monthKey} onChange={(e) => setMonthKey(e.target.value)} className="!bg-white/20 !text-white !border-white/30" />
          </div>
        </div>
      </div>

      {error ? <Alert type="error" message={error} /> : null}

      {loading || !summary || !salary ? (
        <div className="animate-pulse space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl bg-white p-4 shadow-sm"><div className="h-3 w-1/2 rounded bg-zinc-200 mb-2" /><div className="h-6 w-2/3 rounded bg-zinc-200" /></div>
            ))}
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-10 rounded-xl bg-zinc-100" />)}</div>
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3 animate-fadeInUp" style={{ animationDelay: "80ms" }}>
            <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm">
              <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
              <div className="p-3">
                <p className="text-xs uppercase tracking-wide text-amber-600">💸 Chi phí vận hành</p>
                <p className="text-xl font-semibold text-zinc-900">{formatCurrencyVnd(summary.expensesTotalVnd)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowSalary((v) => !v)}
              className="overflow-hidden rounded-2xl border border-zinc-100 bg-white text-left shadow-sm transition hover:shadow-md"
            >
              <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
              <div className="p-3">
                <p className="text-xs uppercase tracking-wide text-blue-600">💵 Lương cơ bản (drilldown)</p>
                <p className="text-xl font-semibold text-zinc-900">{formatCurrencyVnd(summary.baseSalaryTotalVnd)}</p>
              </div>
            </button>
            <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm">
              <div className="h-1 bg-gradient-to-r from-red-500 to-rose-500" />
              <div className="p-3">
                <p className="text-xs uppercase tracking-wide text-red-600">📊 Tổng chi tháng</p>
                <p className="text-xl font-semibold text-zinc-900">{formatCurrencyVnd(summary.grandTotalVnd)}</p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm animate-fadeInUp" style={{ animationDelay: "160ms" }}>
            <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
            <div className="p-4">
              <h3 className="text-sm font-semibold text-zinc-800 mb-2">📋 Breakdown theo danh mục</h3>
              <div className="space-y-2">
                {summary.totalsByCategory.map((item, idx) => (
                  <div key={item.categoryId} className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-3 transition-colors hover:bg-zinc-50 animate-fadeInUp" style={{ animationDelay: `${160 + Math.min(idx * 40, 200)}ms` }}>
                    <p className="text-sm text-zinc-800">{item.categoryName}</p>
                    <p className="text-sm font-semibold text-zinc-900">{formatCurrencyVnd(item.totalVnd)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {showSalary ? (
            <SectionCard
              title="Lương cơ bản theo nhân sự"
              subtitle="Nhập mức lương cơ bản theo tháng và chi nhánh."
              rightAction={
                canEditSalary ? (
                  <Button onClick={saveSalary} disabled={saving}>
                    {saving ? (
                      <span className="inline-flex items-center gap-2">
                        <Spinner /> Đang lưu...
                      </span>
                    ) : (
                      "Lưu lương cơ bản"
                    )}
                  </Button>
                ) : undefined
              }
            >
              <div className="space-y-2">
                {salary.rows.map((row, idx) => (
                  <div key={row.userId} className="grid gap-2 rounded-xl border border-zinc-200 bg-white p-3 md:grid-cols-[1fr_220px_1fr]">
                    <div>
                      <p className="text-sm font-medium text-zinc-900">{row.name}</p>
                      <p className="text-xs text-zinc-500">{row.email}</p>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      value={row.baseSalaryVnd}
                      disabled={!canEditSalary}
                      onChange={(e) => {
                        const value = Number(e.target.value || 0);
                        setSalary((prev) => {
                          if (!prev) return prev;
                          const rows = [...prev.rows];
                          rows[idx] = { ...rows[idx], baseSalaryVnd: value };
                          return { ...prev, rows };
                        });
                      }}
                    />
                    <Input
                      value={row.note}
                      disabled={!canEditSalary}
                      placeholder="Ghi chú"
                      onChange={(e) => {
                        const value = e.target.value;
                        setSalary((prev) => {
                          if (!prev) return prev;
                          const rows = [...prev.rows];
                          rows[idx] = { ...rows[idx], note: value };
                          return { ...prev, rows };
                        });
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-sm text-zinc-700">Tổng lương cơ bản tháng: <span className="font-semibold text-zinc-900">{formatCurrencyVnd(salaryTotal)}</span></p>
              </div>
            </SectionCard>
          ) : null}

          <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm animate-fadeInUp" style={{ animationDelay: "240ms" }}>
            <div className="h-1 bg-gradient-to-r from-yellow-500 to-amber-500" />
            <div className="p-4">
              <h3 className="text-sm font-semibold text-zinc-800 mb-2">💡 Insight chi phí</h3>
              {summary.insights.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 p-6 text-center">
                  <p className="text-sm text-zinc-600">Chưa có insight cho kỳ này.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {summary.insights.map((item) => (
                    <div key={item.id} className="rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-800">
                      {item.summary}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
