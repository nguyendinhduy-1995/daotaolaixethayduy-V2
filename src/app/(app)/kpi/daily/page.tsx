"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, getToken } from "@/lib/auth-client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type KpiResponse = {
  date: string;
  leads: { new: number; hasPhone: number };
  telesale: {
    called: number;
    appointed: number;
    arrived: number;
    signed: number;
    studying: number;
    examined: number;
    result: number;
    lost: number;
  };
  finance: {
    totalThu: number;
    totalPhieuThu: number;
    totalRemaining: number;
    countPaid50: number;
  };
};

function todayInHcm() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

export default function KpiDailyPage() {
  const [date, setDate] = useState(todayInHcm());
  const [data, setData] = useState<KpiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetchJson<KpiResponse>(`/api/kpi/daily?date=${date}`, { token });
      setData(res);
    } catch (e) {
      const err = e as ApiClientError;
      if (err.code === "AUTH_MISSING_BEARER" || err.code === "AUTH_INVALID_TOKEN") clearToken();
      setError(`${err.code}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-zinc-900">KPI Daily</h1>
        <input
          type="date"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <Button onClick={load} disabled={loading}>
          {loading ? (
            <span className="flex items-center gap-2">
              <Spinner /> Refreshing
            </span>
          ) : (
            "Refresh"
          )}
        </Button>
      </div>

      {error ? <Alert type="error" message={error} /> : null}

      {loading && !data ? (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-zinc-200" />
          ))}
        </div>
      ) : null}

      {data ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <p className="text-sm text-zinc-500">Leads New</p>
              <p className="text-2xl font-semibold">{data.leads.new}</p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <p className="text-sm text-zinc-500">Leads Has Phone</p>
              <p className="text-2xl font-semibold">{data.leads.hasPhone}</p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <p className="text-sm text-zinc-500">Total Thu</p>
              <p className="text-2xl font-semibold">{data.finance.totalThu.toLocaleString()}</p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <p className="text-sm text-zinc-500">Total Phieu Thu</p>
              <p className="text-2xl font-semibold">{data.finance.totalPhieuThu}</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <h2 className="mb-3 font-semibold text-zinc-900">Telesale</h2>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(data.telesale).map(([k, v]) => (
                  <div key={k} className="flex justify-between rounded-lg bg-zinc-50 px-3 py-2">
                    <span className="capitalize text-zinc-600">{k}</span>
                    <span className="font-medium text-zinc-900">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <h2 className="mb-3 font-semibold text-zinc-900">Finance</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between rounded-lg bg-zinc-50 px-3 py-2">
                  <span className="text-zinc-600">Total Remaining</span>
                  <span className="font-medium text-zinc-900">{data.finance.totalRemaining.toLocaleString()}</span>
                </div>
                <div className="flex justify-between rounded-lg bg-zinc-50 px-3 py-2">
                  <span className="text-zinc-600">Count Paid 50%</span>
                  <span className="font-medium text-zinc-900">{data.finance.countPaid50}</span>
                </div>
                <div className="rounded-lg bg-zinc-50 px-3 py-2 text-zinc-600">Date: {data.date}</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
