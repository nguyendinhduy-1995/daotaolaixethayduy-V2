"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { fetchMe, getToken, type MeResponse } from "@/lib/auth-client";
import { formatCurrencyVnd, todayInHoChiMinh } from "@/lib/date-utils";
import { hasUiPermission } from "@/lib/ui-permissions";
import { Alert } from "@/components/ui/alert";
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
  const searchParams = useSearchParams();
  const [monthKey, setMonthKey] = useState(searchParams.get("month") || currentMonthKey());
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [salary, setSalary] = useState<BaseSalaryResponse | null>(null);
  const [user, setUser] = useState<MeResponse["user"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSalary, setShowSalary] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
    setSuccess("");
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
    setSuccess("");
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
      setSuccess("Đã lưu lương cơ bản theo tháng.");
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
        title="Tổng hợp chi phí tháng"
        subtitle="Theo dõi chi phí vận hành, lương cơ bản và insight theo chi nhánh."
        rightAction={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/expenses/daily?date=${monthKey}-01`}
              className="inline-flex h-10 items-center rounded-xl border border-zinc-300 px-3 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              Nhập chi phí ngày
            </Link>
            <Input type="month" value={monthKey} onChange={(e) => setMonthKey(e.target.value)} />
          </div>
        }
      >
        <></>
      </SectionCard>

      {error ? <Alert type="error" message={error} /> : null}
      {success ? <Alert type="success" message={success} /> : null}

      {loading || !summary || !salary ? (
        <div className="flex items-center gap-2 text-zinc-700">
          <Spinner /> Đang tải dữ liệu...
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Chi phí vận hành</p>
              <p className="text-xl font-semibold text-zinc-900">{formatCurrencyVnd(summary.expensesTotalVnd)}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowSalary((v) => !v)}
              className="rounded-xl border border-zinc-200 bg-white p-3 text-left transition hover:bg-zinc-50"
            >
              <p className="text-xs uppercase tracking-wide text-zinc-500">Lương cơ bản (drilldown)</p>
              <p className="text-xl font-semibold text-zinc-900">{formatCurrencyVnd(summary.baseSalaryTotalVnd)}</p>
            </button>
            <div className="rounded-xl border border-zinc-200 bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Tổng chi tháng</p>
              <p className="text-xl font-semibold text-zinc-900">{formatCurrencyVnd(summary.grandTotalVnd)}</p>
            </div>
          </div>

          <SectionCard title="Breakdown theo danh mục">
            <div className="space-y-2">
              {summary.totalsByCategory.map((item) => (
                <div key={item.categoryId} className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-3">
                  <p className="text-sm text-zinc-800">{item.categoryName}</p>
                  <p className="text-sm font-semibold text-zinc-900">{formatCurrencyVnd(item.totalVnd)}</p>
                </div>
              ))}
            </div>
          </SectionCard>

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

          <SectionCard title="Insight chi phí">
            {summary.insights.length === 0 ? (
              <p className="text-sm text-zinc-600">Chưa có insight cho kỳ này.</p>
            ) : (
              <div className="space-y-2">
                {summary.insights.map((item) => (
                  <div key={item.id} className="rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-800">
                    {item.summary}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
