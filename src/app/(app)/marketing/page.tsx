"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, getToken } from "@/lib/auth-client";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { FilterCard } from "@/components/ui/filter-card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table } from "@/components/ui/table";
import { formatCurrencyVnd, formatDateTimeVi, todayInHoChiMinh } from "@/lib/date-utils";

type MarketingMetric = {
  id: string;
  source: string;
  grain: "DAY" | "MONTH" | "YEAR";
  dateKey: string;
  spendVnd: number;
  messages: number;
  cplVnd: number;
  createdAt: string;
  updatedAt: string;
};

type MetricsResponse = {
  items: MarketingMetric[];
  totals: { spendVnd: number; messages: number; cplVnd: number };
};

type Grain = "DAY" | "MONTH" | "YEAR";

function parseApiError(error: ApiClientError) {
  return `${error.code}: ${error.message}`;
}

function dateToMonthKey(value: string) {
  return value.slice(0, 7);
}

function dateToYearKey(value: string) {
  return value.slice(0, 4);
}

export default function MarketingPage() {
  const router = useRouter();
  const today = useMemo(() => todayInHoChiMinh(), []);
  const [grain, setGrain] = useState<Grain>("DAY");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [items, setItems] = useState<MarketingMetric[]>([]);
  const [totals, setTotals] = useState({ spendVnd: 0, messages: 0, cplVnd: 0 });

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("source", "meta_ads");
    params.set("grain", grain);
    if (grain === "DAY") {
      params.set("from", from);
      params.set("to", to);
    } else if (grain === "MONTH") {
      params.set("from", dateToMonthKey(from));
      params.set("to", dateToMonthKey(to));
    } else {
      params.set("from", dateToYearKey(from));
      params.set("to", dateToYearKey(to));
    }
    return params.toString();
  }, [from, grain, to]);

  const handleAuthError = useCallback(
    (err: ApiClientError) => {
      if (err.code === "AUTH_MISSING_BEARER" || err.code === "AUTH_INVALID_TOKEN") {
        clearToken();
        router.replace("/login");
        return true;
      }
      return false;
    },
    [router]
  );

  const loadMetrics = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson<MetricsResponse>(`/api/marketing/metrics?${query}`, { token });
      setItems(data.items);
      setTotals(data.totals);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, [handleAuthError, query]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Marketing"
        subtitle="Báo cáo Meta Ads"
        actions={
          <Button variant="secondary" onClick={loadMetrics}>
            Làm mới
          </Button>
        }
      />

      {error ? <Alert type="error" message={error} /> : null}

      <FilterCard
        actions={
          <>
            <Button onClick={loadMetrics}>Áp dụng</Button>
            <Button variant="secondary" onClick={() => setFilterOpen(true)}>
              Bộ lọc
            </Button>
          </>
        }
      >
        <div className="grid gap-2 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Mức thời gian</label>
            <Select value={grain} onChange={(e) => setGrain(e.target.value as Grain)}>
              <option value="DAY">Ngày</option>
              <option value="MONTH">Tháng</option>
              <option value="YEAR">Năm</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Từ</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Đến</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Badge text="Nguồn: meta_ads" tone="accent" />
          </div>
        </div>
      </FilterCard>

      <div className="grid gap-3 md:grid-cols-3">
        <article className="surface p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Chi phí</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrencyVnd(totals.spendVnd)}</p>
        </article>
        <article className="surface p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Nhắn tin</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{totals.messages.toLocaleString("vi-VN")}</p>
        </article>
        <article className="surface p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">CPL</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrencyVnd(Math.round(totals.cplVnd))}</p>
        </article>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">Chi tiết theo kỳ</h2>
        {loading ? (
          <div className="grid gap-2">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : items.length === 0 ? (
          <div className="surface p-6 text-sm text-zinc-600">Không có dữ liệu marketing trong khoảng thời gian đã chọn.</div>
        ) : (
          <>
            <div className="hidden md:block">
              <Table headers={["Kỳ", "Chi phí", "Nhắn tin", "CPL", "Cập nhật lúc"]}>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">{item.dateKey}</td>
                    <td className="px-4 py-3">{formatCurrencyVnd(item.spendVnd)}</td>
                    <td className="px-4 py-3">{item.messages.toLocaleString("vi-VN")}</td>
                    <td className="px-4 py-3">{formatCurrencyVnd(Math.round(item.cplVnd))}</td>
                    <td className="px-4 py-3">{formatDateTimeVi(item.updatedAt)}</td>
                  </tr>
                ))}
              </Table>
            </div>
            <div className="grid gap-2 md:hidden">
              {items.map((item) => (
                <article key={item.id} className="surface p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">Kỳ {item.dateKey}</p>
                    <Badge text={item.grain} tone="primary" />
                  </div>
                  <p className="mt-1 text-sm text-zinc-700">Chi phí: {formatCurrencyVnd(item.spendVnd)}</p>
                  <p className="text-sm text-zinc-700">Nhắn tin: {item.messages.toLocaleString("vi-VN")}</p>
                  <p className="text-sm text-zinc-700">CPL: {formatCurrencyVnd(Math.round(item.cplVnd))}</p>
                  <p className="mt-1 text-xs text-zinc-500">Cập nhật: {formatDateTimeVi(item.updatedAt)}</p>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="surface p-4">
        <h2 className="text-base font-semibold text-slate-900">Hướng dẫn n8n</h2>
        <p className="mt-1 text-sm text-zinc-600">Dùng webhook để đẩy số liệu Meta Ads vào CRM.</p>
        <div className="mt-3 space-y-2 text-sm text-zinc-700">
          <p>
            Endpoint: <code>/api/marketing/ingest</code>
          </p>
          <p>
            Header: <code>x-marketing-secret: MARKETING_SECRET</code>
          </p>
          <pre className="overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs">
{`{
  "source": "meta_ads",
  "grain": "DAY",
  "dateKey": "2026-02-15",
  "spendVnd": 2500000,
  "messages": 42,
  "meta": { "campaign": "Tet Lead Form" }
}`}
          </pre>
        </div>
      </section>

      <BottomSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        title="Bộ lọc marketing"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setFilterOpen(false)}>
              Đóng
            </Button>
            <Button
              onClick={() => {
                setFilterOpen(false);
                loadMetrics();
              }}
            >
              Áp dụng
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Mức thời gian</label>
            <Select value={grain} onChange={(e) => setGrain(e.target.value as Grain)}>
              <option value="DAY">Ngày</option>
              <option value="MONTH">Tháng</option>
              <option value="YEAR">Năm</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Từ</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Đến</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
