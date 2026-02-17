"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { MobileShell } from "@/components/mobile/MobileShell";
import { clearToken, getToken } from "@/lib/auth-client";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { shiftDateYmd, todayInHoChiMinh } from "@/lib/date-utils";

type RatioValue = {
  numerator: number;
  denominator: number;
  valuePct: number;
};

type KpiDailyResponse = {
  date: string;
  monthKey: string;
  timezone: string;
  monthlyClosed: boolean;
  directPage: {
    hasPhoneRate: {
      daily: RatioValue;
      monthly: RatioValue;
    };
  };
  tuVan: {
    appointedRate: {
      daily: RatioValue;
      monthly: RatioValue;
    };
    arrivedRate: {
      daily: RatioValue;
      monthly: RatioValue;
    };
    signedRate: {
      daily: RatioValue;
      monthly: RatioValue;
    };
  };
};

function parseError(error: unknown) {
  const e = error as ApiClientError;
  return `${e.code || "INTERNAL_ERROR"}: ${e.message || "Lỗi không xác định"}`;
}

function fmtPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

function RatioCard({ label, daily, monthly }: { label: string; daily: RatioValue; monthly: RatioValue }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-zinc-700">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-zinc-900">{fmtPercent(daily.valuePct)}</p>
      <p className="mt-1 text-xs text-zinc-500">Ngày: {daily.numerator}/{daily.denominator}</p>
      <div className="mt-3 border-t border-zinc-100 pt-3">
        <p className="text-sm font-medium text-zinc-700">{fmtPercent(monthly.valuePct)}</p>
        <p className="text-xs text-zinc-500">Tháng: {monthly.numerator}/{monthly.denominator}</p>
      </div>
    </div>
  );
}

export default function KpiDailyPage() {
  const router = useRouter();
  const [date, setDate] = useState(todayInHoChiMinh());
  const [data, setData] = useState<KpiDailyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const subtitle = useMemo(() => {
    if (!data) return "Theo dõi KPI phần trăm theo ngày và lũy kế tháng";
    return data.monthlyClosed
      ? `Đã chốt KPI tháng ${data.monthKey}`
      : `Lũy kế tháng ${data.monthKey} tới ngày ${data.date}`;
  }, [data]);

  const loadData = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const kpi = await fetchJson<KpiDailyResponse>(`/api/kpi/daily?date=${date}`, { token });
      setData(kpi);
    } catch (e) {
      const err = e as ApiClientError;
      if (err.code === "AUTH_MISSING_BEARER" || err.code === "AUTH_INVALID_TOKEN") {
        clearToken();
        router.replace("/login");
        return;
      }
      setError(`Lỗi tải KPI: ${parseError(e)}`);
    } finally {
      setLoading(false);
    }
  }, [date, router]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <MobileShell title="KPI ngày" subtitle={subtitle}>
      <div className="space-y-4 py-3">
        {error ? <Alert type="error" message={error} /> : null}

        <section className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <p className="mb-1 text-xs text-zinc-500">Ngày dữ liệu</p>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <Button variant="secondary" onClick={() => setDate(todayInHoChiMinh())}>
              Hôm nay
            </Button>
            <Button variant="secondary" onClick={() => setDate(shiftDateYmd(todayInHoChiMinh(), -1))}>
              Hôm qua
            </Button>
            <Button onClick={loadData} disabled={loading}>
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner /> Đang tải...
                </span>
              ) : (
                "Làm mới"
              )}
            </Button>
          </div>
        </section>

        {!data && loading ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">Đang tải dữ liệu KPI...</div>
        ) : null}

        {data ? (
          <>
            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Trực Page</h2>
              <RatioCard
                label="Tỉ lệ lấy được số"
                daily={data.directPage.hasPhoneRate.daily}
                monthly={data.directPage.hasPhoneRate.monthly}
              />
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Tư vấn</h2>
              <div className="grid gap-3 md:grid-cols-3">
                <RatioCard
                  label="Tỉ lệ hẹn từ data"
                  daily={data.tuVan.appointedRate.daily}
                  monthly={data.tuVan.appointedRate.monthly}
                />
                <RatioCard
                  label="Tỉ lệ đến từ hẹn"
                  daily={data.tuVan.arrivedRate.daily}
                  monthly={data.tuVan.arrivedRate.monthly}
                />
                <RatioCard
                  label="Tỉ lệ ký từ đến"
                  daily={data.tuVan.signedRate.daily}
                  monthly={data.tuVan.signedRate.monthly}
                />
              </div>
            </section>
          </>
        ) : null}
      </div>
    </MobileShell>
  );
}
