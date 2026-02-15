"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, fetchMe, getToken } from "@/lib/auth-client";
import { isAdminRole } from "@/lib/admin-auth";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilterCard } from "@/components/ui/filter-card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Table } from "@/components/ui/table";
import { MobileTopbar } from "@/components/admin/mobile-topbar";
import { QuickSearchRow } from "@/components/admin/quick-search-row";
import { FiltersSheet } from "@/components/admin/filters-sheet";
import { AdminCardItem, AdminCardList } from "@/components/admin/admin-card-list";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admin/ui-states";
import { formatCurrencyVnd, formatDateTimeVi, todayInHoChiMinh } from "@/lib/date-utils";
import { useAdminListState } from "@/lib/use-admin-list-state";

type Branch = {
  id: string;
  name: string;
};

type MarketingReport = {
  id: string;
  date: string;
  dateKey: string;
  branchId: string | null;
  source: string;
  spendVnd: number;
  messages: number;
  cplVnd: number;
  updatedAt: string;
  branch: { id: string; name: string } | null;
};

type ReportsResponse = {
  items: MarketingReport[];
  totals: { spendVnd: number; messages: number; cplVnd: number };
  tz: string;
};

function parseApiError(error: ApiClientError) {
  return `${error.code}: ${error.message}`;
}

function daysAgo(ymd: string, days: number) {
  const date = new Date(`${ymd}T00:00:00`);
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

export default function MarketingPage() {
  const router = useRouter();
  const today = useMemo(() => todayInHoChiMinh(), []);

  const [checkingRole, setCheckingRole] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [from, setFrom] = useState(daysAgo(today, 29));
  const [to, setTo] = useState(today);
  const [branchId, setBranchId] = useState("");
  const [source, setSource] = useState("meta");

  const [branches, setBranches] = useState<Branch[]>([]);
  const [items, setItems] = useState<MarketingReport[]>([]);
  const [totals, setTotals] = useState({ spendVnd: 0, messages: 0, cplVnd: 0 });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [manualOpen, setManualOpen] = useState(false);
  const [manualDate, setManualDate] = useState(today);
  const [manualBranchId, setManualBranchId] = useState("");
  const [manualSource, setManualSource] = useState("meta");
  const [manualSpend, setManualSpend] = useState("0");
  const [manualMessages, setManualMessages] = useState("0");
  const [manualMeta, setManualMeta] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const listState = useAdminListState({ query: "", filters: {}, paging: { page: 1, pageSize: 20 } });

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("from", from);
    params.set("to", to);
    if (branchId) params.set("branchId", branchId);
    if (source) params.set("source", source);
    return params.toString();
  }, [branchId, from, source, to]);

  const filteredItems = useMemo(() => {
    const q = listState.debouncedQ.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      return (
        item.dateKey.toLowerCase().includes(q) ||
        (item.branch?.name || "toàn hệ thống").toLowerCase().includes(q) ||
        item.source.toLowerCase().includes(q)
      );
    });
  }, [items, listState.debouncedQ]);

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

  const loadData = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    setLoading(true);
    setError("");
    try {
      const [reportsRes, branchesRes] = await Promise.all([
        fetchJson<ReportsResponse>(`/api/admin/marketing/reports?${query}`, { token }),
        fetchJson<{ items: Branch[] }>("/api/admin/branches", { token }),
      ]);
      setItems(reportsRes.items);
      setTotals(reportsRes.totals);
      setBranches(branchesRes.items);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, [handleAuthError, query]);

  useEffect(() => {
    fetchMe()
      .then((data) => setIsAdmin(isAdminRole(data.user.role)))
      .catch(() => {
        clearToken();
        router.replace("/login");
      })
      .finally(() => setCheckingRole(false));
  }, [router]);

  useEffect(() => {
    if (isAdmin) void loadData();
  }, [isAdmin, loadData]);

  async function submitManual() {
    const token = getToken();
    if (!token) return;
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      let meta: unknown = undefined;
      if (manualMeta.trim()) {
        meta = JSON.parse(manualMeta);
      }
      await fetchJson<{ ok: boolean; item: MarketingReport }>("/api/admin/marketing/report", {
        method: "POST",
        token,
        body: {
          date: manualDate,
          branchId: manualBranchId || undefined,
          source: manualSource,
          spendVnd: Number(manualSpend),
          messages: Number(manualMessages),
          meta,
        },
      });
      setSuccess("Đã lưu báo cáo marketing.");
      setManualOpen(false);
      await loadData();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(parseApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingRole) {
    return (
      <div className="flex items-center gap-2 text-zinc-700">
        <Spinner /> Đang kiểm tra quyền...
      </div>
    );
  }

  if (!isAdmin) {
    return <Alert type="error" message="Bạn không có quyền truy cập trang Marketing." />;
  }

  return (
    <div className="space-y-4">
      <MobileTopbar
        title="Marketing"
        subtitle="Báo cáo Meta Ads"
        actionNode={
          <Button className="min-h-11" onClick={() => setManualOpen(true)}>
            Nhập tay
          </Button>
        }
      />

      <PageHeader
        title="Marketing"
        subtitle="Báo cáo Meta Ads theo ngày"
        actions={
          <>
            <Button variant="secondary" onClick={() => void loadData()}>
              Làm mới
            </Button>
            <Button onClick={() => setManualOpen(true)}>Nhập tay</Button>
          </>
        }
      />

      {error ? <Alert type="error" message={error} /> : null}
      {success ? <Alert type="success" message={success} /> : null}

      <QuickSearchRow
        value={listState.q}
        onChange={listState.setQ}
        onOpenFilter={() => setMobileFilterOpen(true)}
        placeholder="Tìm theo ngày/chi nhánh/nguồn"
        activeFilterCount={[from, to, branchId, source].filter(Boolean).length}
      />

      <FiltersSheet
        open={mobileFilterOpen}
        onOpenChange={setMobileFilterOpen}
        title="Bộ lọc marketing"
        onApply={() => void loadData()}
        onClear={() => {
          setFrom(daysAgo(today, 29));
          setTo(today);
          setBranchId("");
          setSource("meta");
        }}
      >
        <div className="space-y-3">
          <label className="space-y-1 text-sm text-zinc-700">
            <span>Từ ngày</span>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="space-y-1 text-sm text-zinc-700">
            <span>Đến ngày</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label className="space-y-1 text-sm text-zinc-700">
            <span>Chi nhánh</span>
            <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">Toàn hệ thống</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1 text-sm text-zinc-700">
            <span>Nguồn</span>
            <Input value={source} onChange={(e) => setSource(e.target.value.toLowerCase())} />
          </label>
        </div>
      </FiltersSheet>

      <FilterCard title="Bộ lọc marketing">
        <div className="grid gap-3 md:grid-cols-5">
          <label className="space-y-1 text-sm text-zinc-700">
            <span>Từ ngày</span>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="space-y-1 text-sm text-zinc-700">
            <span>Đến ngày</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label className="space-y-1 text-sm text-zinc-700">
            <span>Chi nhánh</span>
            <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">Toàn hệ thống</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1 text-sm text-zinc-700">
            <span>Nguồn</span>
            <Input value={source} onChange={(e) => setSource(e.target.value.toLowerCase())} />
          </label>
          <div className="flex items-end">
            <Button onClick={() => void loadData()}>Áp dụng</Button>
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
          <p className="text-xs uppercase tracking-wide text-zinc-500">Chi phí / 1 học viên liên hệ</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrencyVnd(totals.cplVnd)}</p>
        </article>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">Danh sách báo cáo</h2>
        {loading ? (
          <>
            <LoadingSkeleton text="Đang tải báo cáo marketing..." />
            <div className="hidden md:grid md:gap-2">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          </>
        ) : error ? (
          <ErrorState detail={error} />
        ) : filteredItems.length === 0 ? (
          <EmptyState text="Không có dữ liệu trong khoảng thời gian đã chọn." />
        ) : (
          <>
            <div className="hidden md:block">
              <Table headers={["Ngày", "Chi nhánh", "Nguồn", "Chi phí", "Nhắn tin", "CPL", "Cập nhật"]}>
                {filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">{item.dateKey}</td>
                    <td className="px-4 py-3">{item.branch?.name || "Toàn hệ thống"}</td>
                    <td className="px-4 py-3">{item.source}</td>
                    <td className="px-4 py-3">{formatCurrencyVnd(item.spendVnd)}</td>
                    <td className="px-4 py-3">{item.messages.toLocaleString("vi-VN")}</td>
                    <td className="px-4 py-3">{formatCurrencyVnd(item.cplVnd)}</td>
                    <td className="px-4 py-3">{formatDateTimeVi(item.updatedAt)}</td>
                  </tr>
                ))}
              </Table>
            </div>
            <AdminCardList>
              {filteredItems.map((item) => (
                <AdminCardItem
                  key={item.id}
                  title={item.dateKey}
                  subtitle={item.branch?.name || "Toàn hệ thống"}
                  meta={
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge text={item.source} tone="accent" />
                        <span className="text-xs text-zinc-500">{formatDateTimeVi(item.updatedAt)}</span>
                      </div>
                      <p>Chi phí: {formatCurrencyVnd(item.spendVnd)}</p>
                      <p>Nhắn tin: {item.messages.toLocaleString("vi-VN")}</p>
                      <p>CPL: {formatCurrencyVnd(item.cplVnd)}</p>
                    </div>
                  }
                />
              ))}
            </AdminCardList>
          </>
        )}
      </section>

      <section className="surface p-4">
        <h2 className="text-base font-semibold text-slate-900">Hướng dẫn n8n</h2>
        <p className="mt-1 text-sm text-zinc-600">Dùng webhook secret để đẩy báo cáo Meta Ads vào CRM.</p>
        <div className="mt-3 space-y-2 text-sm text-zinc-700">
          <p>
            Endpoint: <code>/api/marketing/report</code>
          </p>
          <p>
            Header: <code>x-marketing-secret: MARKETING_SECRET</code>
          </p>
          <pre className="overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs">
{`{
  "date": "2026-02-15",
  "source": "meta",
  "branchCode": "HCM",
  "spendVnd": 2500000,
  "messages": 42,
  "meta": { "campaign": "Lead Form" }
}`}
          </pre>
        </div>
      </section>

      <Modal open={manualOpen} onClose={() => setManualOpen(false)} title="Nhập báo cáo marketing thủ công">
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm text-zinc-700">
              <span>Ngày</span>
              <Input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} />
            </label>
            <label className="space-y-1 text-sm text-zinc-700">
              <span>Nguồn</span>
              <Input value={manualSource} onChange={(e) => setManualSource(e.target.value.toLowerCase())} />
            </label>
            <label className="space-y-1 text-sm text-zinc-700">
              <span>Chi nhánh</span>
              <Select value={manualBranchId} onChange={(e) => setManualBranchId(e.target.value)}>
                <option value="">Toàn hệ thống</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-1 text-sm text-zinc-700">
              <span>Chi phí (VND)</span>
              <Input type="number" min={0} value={manualSpend} onChange={(e) => setManualSpend(e.target.value)} />
            </label>
            <label className="space-y-1 text-sm text-zinc-700">
              <span>Nhắn tin</span>
              <Input type="number" min={0} value={manualMessages} onChange={(e) => setManualMessages(e.target.value)} />
            </label>
          </div>
          <label className="space-y-1 text-sm text-zinc-700">
            <span>Meta JSON (tùy chọn)</span>
            <textarea
              value={manualMeta}
              onChange={(e) => setManualMeta(e.target.value)}
              className="min-h-24 w-full rounded-xl border border-[var(--border)] p-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-[var(--ring)]"
              placeholder='{"campaign":"Lead Form"}'
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setManualOpen(false)}>
              Hủy
            </Button>
            <Button onClick={submitManual} disabled={submitting}>
              Lưu báo cáo
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
