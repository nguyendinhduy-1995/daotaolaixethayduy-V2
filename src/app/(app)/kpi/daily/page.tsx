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
    calledRate: {
      daily: RatioValue;
      monthly: RatioValue;
    };
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

/* ── Circular progress ring ─────────────────────────────────── */
function CircleProgress({ value, color }: { value: number; color: string }) {
  const pct = Math.min(100, Math.max(0, value));
  const r = 28;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="shrink-0">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#e4e4e7" strokeWidth="5" />
      <circle
        cx="36" cy="36" r={r}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)", transform: "rotate(-90deg)", transformOrigin: "center" }}
      />
      <text x="36" y="40" textAnchor="middle" className="text-[11px] font-bold" fill={color}>
        {pct > 0 ? `${Math.round(pct)}%` : "0%"}
      </text>
    </svg>
  );
}

/* ── Enhanced ratio card with gradient accent ────────────────── */
function RatioCard({
  label, icon, daily, monthly, gradient, accentColor, delay,
}: {
  label: string;
  icon: string;
  daily: RatioValue;
  monthly: RatioValue;
  gradient: string;
  accentColor: string;
  delay: string;
}) {
  return (
    <div className={`animate-fadeInUp ${delay} group relative overflow-hidden rounded-2xl border border-zinc-200/60 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5`}>
      {/* Top gradient accent line */}
      <div className={`absolute inset-x-0 top-0 h-1 ${gradient}`} />

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">{icon}</span>
            <p className="text-sm font-semibold text-zinc-700 truncate">{label}</p>
          </div>

          {/* Daily value — large */}
          <p className="text-3xl font-bold text-zinc-900 tracking-tight">{fmtPercent(daily.valuePct)}</p>
          <p className="mt-1 text-xs text-zinc-400 font-medium">
            Ngày: <span className="text-zinc-600">{daily.numerator}/{daily.denominator}</span>
          </p>
        </div>

        {/* Circular progress */}
        <CircleProgress value={daily.valuePct} color={accentColor} />
      </div>

      {/* Monthly section */}
      <div className="mt-4 rounded-xl bg-zinc-50/80 px-3 py-2.5 border border-zinc-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-400 font-medium">Lũy kế tháng</p>
            <p className="text-lg font-bold text-zinc-800">{fmtPercent(monthly.valuePct)}</p>
          </div>
          <p className="text-xs text-zinc-500">
            {monthly.numerator}/{monthly.denominator}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Skeleton for loading state ──────────────────────────────── */
function KpiSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-6 w-32 rounded-lg bg-zinc-200" />
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 h-40" />
      <div className="h-6 w-28 rounded-lg bg-zinc-200" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-zinc-200 bg-white p-5 h-48" />
        ))}
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
      <div className="space-y-6 py-3">
        {error ? <Alert type="error" message={error} /> : null}

        {/* ── Filter Bar ────────────────────────────────── */}
        <section className="animate-fadeInUp delay-1 rounded-2xl border border-zinc-200/60 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">📅 Ngày dữ liệu</p>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setDate(todayInHoChiMinh())}
                className={date === todayInHoChiMinh() ? "ring-2 ring-blue-400/50 bg-blue-50 text-blue-700" : ""}
              >
                Hôm nay
              </Button>
              <Button
                variant="secondary"
                onClick={() => setDate(shiftDateYmd(todayInHoChiMinh(), -1))}
                className={date === shiftDateYmd(todayInHoChiMinh(), -1) ? "ring-2 ring-blue-400/50 bg-blue-50 text-blue-700" : ""}
              >
                Hôm qua
              </Button>
            </div>
            <Button variant="accent" onClick={loadData} disabled={loading}>
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner /> Đang tải...
                </span>
              ) : (
                "🔄 Làm mới"
              )}
            </Button>
          </div>
        </section>

        {/* ── Loading Skeleton ──────────────────────────── */}
        {!data && loading ? <KpiSkeleton /> : null}

        {data ? (
          <>
            {/* ── Trực Page Section ───────────────────────── */}
            <section className="animate-fadeInUp delay-2 space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-blue text-white text-sm">📱</div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-600">Trực Page</h2>
              </div>
              <RatioCard
                label="Tỉ lệ lấy được số"
                icon="📊"
                daily={data.directPage.hasPhoneRate.daily}
                monthly={data.directPage.hasPhoneRate.monthly}
                gradient="gradient-blue"
                accentColor="#3b82f6"
                delay=""
              />
            </section>

            {/* ── Tư vấn Section ──────────────────────────── */}
            <section className="animate-fadeInUp delay-3 space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-emerald text-white text-sm">📞</div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-600">Tư vấn — Funnel chuyển đổi</h2>
              </div>

              {/* Funnel flow indicator */}
              <div className="flex items-center gap-1 rounded-xl bg-zinc-50 px-4 py-2 text-xs font-medium text-zinc-500 overflow-x-auto">
                <span className="inline-flex items-center gap-1 whitespace-nowrap"><span className="h-2 w-2 rounded-full bg-blue-400" /> Data</span>
                <span className="text-zinc-300">→</span>
                <span className="inline-flex items-center gap-1 whitespace-nowrap"><span className="h-2 w-2 rounded-full bg-cyan-400" /> Gọi</span>
                <span className="text-zinc-300">→</span>
                <span className="inline-flex items-center gap-1 whitespace-nowrap"><span className="h-2 w-2 rounded-full bg-violet-400" /> Hẹn</span>
                <span className="text-zinc-300">→</span>
                <span className="inline-flex items-center gap-1 whitespace-nowrap"><span className="h-2 w-2 rounded-full bg-amber-400" /> Đến</span>
                <span className="text-zinc-300">→</span>
                <span className="inline-flex items-center gap-1 whitespace-nowrap"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Ký</span>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <RatioCard
                  label="Tỉ lệ gọi / Data"
                  icon="📞"
                  daily={data.tuVan.calledRate.daily}
                  monthly={data.tuVan.calledRate.monthly}
                  gradient="bg-gradient-to-r from-cyan-500 to-blue-500"
                  accentColor="#06b6d4"
                  delay="delay-1"
                />
                <RatioCard
                  label="Tỉ lệ hẹn / Gọi"
                  icon="📋"
                  daily={data.tuVan.appointedRate.daily}
                  monthly={data.tuVan.appointedRate.monthly}
                  gradient="bg-gradient-to-r from-violet-500 to-purple-500"
                  accentColor="#8b5cf6"
                  delay="delay-2"
                />
                <RatioCard
                  label="Tỉ lệ đến / Hẹn"
                  icon="🏢"
                  daily={data.tuVan.arrivedRate.daily}
                  monthly={data.tuVan.arrivedRate.monthly}
                  gradient="bg-gradient-to-r from-amber-500 to-orange-500"
                  accentColor="#f59e0b"
                  delay="delay-3"
                />
                <RatioCard
                  label="Tỉ lệ ký / Đến"
                  icon="✅"
                  daily={data.tuVan.signedRate.daily}
                  monthly={data.tuVan.signedRate.monthly}
                  gradient="gradient-emerald"
                  accentColor="#10b981"
                  delay="delay-4"
                />
              </div>
            </section>

            {/* ── Month Status Banner ────────────────────── */}
            {data.monthlyClosed ? (
              <div className="animate-fadeInUp delay-5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
                <span>🔒</span>
                <span>Tháng <strong>{data.monthKey}</strong> đã được chốt KPI</span>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </MobileShell>
  );
}
