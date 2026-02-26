"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, fetchMe, getToken } from "@/lib/auth-client";
import { isAdminRole, isTelesalesRole } from "@/lib/admin-auth";
import { Alert } from "@/components/ui/alert";
import { MobileToolbar } from "@/components/app/mobile-toolbar";
import { MobileShell } from "@/components/mobile/MobileShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilterCard } from "@/components/ui/filter-card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { MobileFiltersSheet } from "@/components/mobile/MobileFiltersSheet";
import { formatDateTimeVi } from "@/lib/date-utils";

type Lead = {
  id: string;
  fullName: string | null;
  phone: string | null;
  source: string | null;
  channel: string | null;
  licenseType: string | null;
  ownerId: string | null;
  lastContactAt: string | null;
  createdAt: string;
  status: string;
  owner?: {
    id: string;
    name: string | null;
    email: string;
    role: string;
    isActive: boolean;
  } | null;
};

type LeadListResponse = {
  items: Lead[];
};

type UserOption = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isActive: boolean;
};

type UsersResponse = { items: UserOption[] };

const STATUSES = ["NEW", "HAS_PHONE", "APPOINTED", "ARRIVED", "SIGNED", "STUDYING", "EXAMED", "RESULT", "LOST"];
const EVENT_OPTIONS = [...STATUSES, "CALLED"];

const STATUS_LABELS: Record<string, string> = {
  NEW: "Mới",
  HAS_PHONE: "Đã có SĐT",
  APPOINTED: "Đã hẹn",
  ARRIVED: "Đã đến",
  SIGNED: "Đã ghi danh",
  STUDYING: "Đang học",
  EXAMED: "Đã thi",
  RESULT: "Có kết quả",
  LOST: "Mất",
};

type Filters = {
  q: string;
  source: string;
  channel: string;
  licenseType: string;
  ownerId: string;
  createdFrom: string;
  createdTo: string;
};

const EMPTY_FILTERS: Filters = {
  q: "",
  source: "",
  channel: "",
  licenseType: "",
  ownerId: "",
  createdFrom: "",
  createdTo: "",
};

function formatError(err: ApiClientError) {
  return `${err.code}: ${err.message}`;
}

function dateYmdLocal(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}


const STATUS_STYLE: Record<string, { icon: string; bg: string; text: string; border: string; gradient: string; headerGradient: string }> = {
  NEW: { icon: "🆕", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", gradient: "from-blue-500 to-cyan-500", headerGradient: "from-blue-500/10 to-cyan-500/5" },
  HAS_PHONE: { icon: "📱", bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200", gradient: "from-teal-500 to-emerald-500", headerGradient: "from-teal-500/10 to-emerald-500/5" },
  APPOINTED: { icon: "📅", bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", gradient: "from-orange-500 to-amber-500", headerGradient: "from-orange-500/10 to-amber-500/5" },
  ARRIVED: { icon: "🏢", bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", gradient: "from-purple-500 to-violet-500", headerGradient: "from-purple-500/10 to-violet-500/5" },
  SIGNED: { icon: "✍️", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", gradient: "from-emerald-500 to-green-600", headerGradient: "from-emerald-500/10 to-green-600/5" },
  STUDYING: { icon: "📚", bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", gradient: "from-indigo-500 to-blue-600", headerGradient: "from-indigo-500/10 to-blue-600/5" },
  EXAMED: { icon: "📝", bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200", gradient: "from-sky-500 to-blue-500", headerGradient: "from-sky-500/10 to-blue-500/5" },
  RESULT: { icon: "🏆", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", gradient: "from-amber-500 to-yellow-500", headerGradient: "from-amber-500/10 to-yellow-500/5" },
  LOST: { icon: "❌", bg: "bg-red-50", text: "text-red-700", border: "border-red-200", gradient: "from-red-500 to-rose-500", headerGradient: "from-red-500/10 to-rose-500/5" },
};

function getStatusStyle(status: string) {
  return STATUS_STYLE[status] || STATUS_STYLE.NEW;
}

function BoardSkeleton() {
  return (
    <div className="flex min-w-max gap-3 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="w-[320px] shrink-0 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
          <div className="mb-3 h-10 rounded-xl bg-zinc-200" />
          <div className="space-y-2">
            <div className="h-28 rounded-xl bg-zinc-100" />
            <div className="h-28 rounded-xl bg-zinc-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LeadsBoardPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [mobileStatus, setMobileStatus] = useState("NEW");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [canManageOwner, setCanManageOwner] = useState(false);
  const [isTelesales, setIsTelesales] = useState(false);
  const [owners, setOwners] = useState<UserOption[]>([]);
  const [byStatus, setByStatus] = useState<Record<string, Lead[]>>({});
  const [draggingLead, setDraggingLead] = useState<Lead | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [eventLeadId, setEventLeadId] = useState("");
  const [eventOpen, setEventOpen] = useState(false);
  const [eventType, setEventType] = useState("CALLED");
  const [eventNote, setEventNote] = useState("");
  const [eventMeta, setEventMeta] = useState("");
  const [eventSaving, setEventSaving] = useState(false);

  const [assignLead, setAssignLead] = useState<Lead | null>(null);
  const [assignOwnerId, setAssignOwnerId] = useState("");
  const [assignSaving, setAssignSaving] = useState(false);

  useEffect(() => {
    setFilters({
      q: searchParams.get("q") || "",
      source: searchParams.get("source") || "",
      channel: searchParams.get("channel") || "",
      licenseType: searchParams.get("licenseType") || "",
      ownerId: searchParams.get("ownerId") || "",
      createdFrom: searchParams.get("createdFrom") || "",
      createdTo: searchParams.get("createdTo") || "",
    });
  }, [searchParams]);

  const applyFiltersToUrl = useCallback(
    (next: Filters) => {
      const params = new URLSearchParams();
      Object.entries(next).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });
      router.replace(`${pathname}?${params.toString()}`);
    },
    [pathname, router]
  );

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

  useEffect(() => {
    fetchMe()
      .then((data) => {
        setCanManageOwner(isAdminRole(data.user.role));
        setIsTelesales(isTelesalesRole(data.user.role));
      })
      .catch(() => {
        setCanManageOwner(false);
        setIsTelesales(false);
      });
  }, []);

  const loadOwners = useCallback(async () => {
    if (!canManageOwner) {
      setOwners([]);
      return;
    }
    const token = getToken();
    if (!token) return;
    try {
      const data = await fetchJson<UsersResponse>("/api/users?page=1&pageSize=100&isActive=true", { token });
      const active = data.items.filter((item) => item.isActive && item.role !== "admin");
      const saleLike = active.filter((item) => item.role === "telesales" || item.role === "direct_page");
      setOwners(saleLike.length > 0 ? saleLike : active);
    } catch {
      setOwners([]);
    }
  }, [canManageOwner]);

  useEffect(() => {
    loadOwners();
  }, [loadOwners]);

  const baseParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("pageSize", "100");
    params.set("sort", "createdAt");
    params.set("order", "desc");
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    return params;
  }, [filters]);

  const loadBoard = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const results = await Promise.all(
        STATUSES.map(async (status) => {
          const params = new URLSearchParams(baseParams);
          params.set("status", status);
          const res = await fetchJson<LeadListResponse>(`/api/leads?${params.toString()}`, { token });
          return [status, res.items] as const;
        })
      );
      const grouped = Object.fromEntries(results);
      setByStatus(grouped);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(formatError(err));
    } finally {
      setLoading(false);
    }
  }, [baseParams, handleAuthError]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  async function changeStatus(leadId: string, currentStatus: string, nextStatus: string) {
    if (currentStatus === nextStatus) return;
    const token = getToken();
    if (!token) return;
    setUpdatingId(leadId);

    const snapshot = byStatus;
    const lead = snapshot[currentStatus]?.find((item) => item.id === leadId) || null;
    if (!lead) return;

    const optimistic: Record<string, Lead[]> = {};
    for (const s of STATUSES) {
      optimistic[s] = (snapshot[s] || []).filter((item) => item.id !== leadId);
    }
    optimistic[nextStatus] = [{ ...lead, status: nextStatus }, ...(optimistic[nextStatus] || [])];
    setByStatus(optimistic);

    try {
      await fetchJson(`/api/leads/${leadId}`, {
        method: "PATCH",
        token,
        body: { status: nextStatus },
      });
    } catch (e) {
      const err = e as ApiClientError;
      setByStatus(snapshot);
      if (!handleAuthError(err)) setError(formatError(err));
    } finally {
      setUpdatingId(null);
    }
  }

  async function onDrop(targetStatus: string) {
    if (!draggingLead) return;
    await changeStatus(draggingLead.id, draggingLead.status, targetStatus);
    setDraggingLead(null);
  }

  async function submitEvent() {
    if (!eventLeadId) return;
    const token = getToken();
    if (!token) return;
    setEventSaving(true);
    setError("");
    try {
      const meta = eventMeta.trim() ? JSON.parse(eventMeta) : undefined;
      await fetchJson(`/api/leads/${eventLeadId}/events`, {
        method: "POST",
        token,
        body: { type: eventType, note: eventNote || undefined, meta },
      });
      setEventOpen(false);
      setEventLeadId("");
      setEventType("CALLED");
      setEventNote("");
      setEventMeta("");
      await loadBoard();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(formatError(err));
    } finally {
      setEventSaving(false);
    }
  }

  async function submitAssignOwner() {
    if (!assignLead) return;
    const token = getToken();
    if (!token) return;
    setAssignSaving(true);
    setError("");
    try {
      await fetchJson(`/api/leads/${assignLead.id}`, {
        method: "PATCH",
        token,
        body: { ownerId: assignOwnerId || null },
      });
      setAssignLead(null);
      setAssignOwnerId("");
      await loadBoard();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(formatError(err));
    } finally {
      setAssignSaving(false);
    }
  }

  return (
    <MobileShell
      title="Bảng trạng thái khách hàng"
      subtitle="Pipeline theo trạng thái"
    >
      <div className="space-y-4 pb-24 md:pb-0">

        {/* ── Premium Header ── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-800 via-slate-700 to-zinc-800 p-4 text-white shadow-lg shadow-slate-300 animate-fadeInUp">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/5 blur-xl" />
          <div className="relative flex flex-wrap items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-2xl backdrop-blur-sm">📊</div>
            <div className="flex-1">
              <h2 className="text-lg font-bold">Pipeline khách hàng</h2>
              <p className="text-sm text-white/70">Theo dõi & kéo thả chuyển đổi trạng thái</p>
            </div>
            <div className="flex items-center gap-2">
              {canManageOwner ? <Badge text="Admin" tone="accent" /> : null}
              <Button onClick={loadBoard} className="!bg-white/10 !text-white hover:!bg-white/20 backdrop-blur-sm">
                {loading ? (
                  <span className="inline-flex items-center gap-2"><Spinner /> Đang tải...</span>
                ) : "Làm mới"}
              </Button>
            </div>
          </div>
          {/* Column totals */}
          <div className="relative mt-3 flex flex-wrap gap-1.5">
            {STATUSES.map((st) => {
              const s = getStatusStyle(st);
              const count = (byStatus[st] || []).length;
              return (
                <span key={st} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-white/80 backdrop-blur-sm">
                  {s.icon} {count}
                </span>
              );
            })}
          </div>
        </div>

        {/* ── Compact Filter / Status Tabs ── */}
        <div className="sticky top-[116px] z-20 space-y-2 rounded-2xl border border-zinc-200 bg-white/95 p-2 shadow-sm backdrop-blur md:top-[72px]">
          <div className="flex items-center gap-2">
            <Input
              value={filters.q}
              placeholder="🔍 Tìm kiếm..."
              className="!rounded-xl !text-sm flex-1"
              onChange={(e) => setFilters((s) => ({ ...s, q: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") applyFiltersToUrl(filters); }}
            />
            <button
              type="button"
              onClick={() => {
                const today = dateYmdLocal(new Date());
                const next = { ...filters, createdFrom: today, createdTo: today };
                setFilters(next);
                applyFiltersToUrl(next);
              }}
              className="shrink-0 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 active:scale-95"
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={() => setFilterOpen(true)}
              className="shrink-0 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 active:scale-95"
            >
              ⚙️ Lọc
            </button>
            <button
              type="button"
              onClick={() => { setFilters(EMPTY_FILTERS); applyFiltersToUrl(EMPTY_FILTERS); }}
              className="shrink-0 rounded-xl px-2 py-2 text-xs text-zinc-400 hover:text-zinc-700 transition"
            >
              ✕
            </button>
          </div>

          {/* Active filter badges */}
          {(filters.source || filters.channel || filters.licenseType || filters.createdFrom) ? (
            <div className="flex flex-wrap gap-1 px-1">
              {filters.source ? <Badge text={`Nguồn: ${filters.source}`} tone="accent" /> : null}
              {filters.channel ? <Badge text={`Kênh: ${filters.channel}`} tone="accent" /> : null}
              {filters.licenseType ? <Badge text={`Bằng: ${filters.licenseType}`} tone="primary" /> : null}
              {(filters.createdFrom || filters.createdTo) ? <Badge text={`📅 ${filters.createdFrom || "..."} → ${filters.createdTo || "..."}`} tone="neutral" /> : null}
            </div>
          ) : null}

          {/* Mobile status tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 md:hidden">
            {STATUSES.map((status) => {
              const s = getStatusStyle(status);
              const count = (byStatus[status] || []).length;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setMobileStatus(status)}
                  className={`flex items-center gap-1 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold transition-all active:scale-95 ${mobileStatus === status
                      ? `bg-gradient-to-r ${s.gradient} text-white shadow-md shadow-${status === "NEW" ? "blue" : "zinc"}-200`
                      : `border ${s.border} ${s.bg} ${s.text}`
                    }`}
                >
                  {s.icon}
                  <span>{STATUS_LABELS[status]}</span>
                  <span className={`ml-0.5 rounded-full ${mobileStatus === status ? "bg-white/30" : "bg-black/5"} px-1.5 py-0.5 text-[10px] font-bold`}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {error ? <Alert type="error" message={error} /> : null}

        {/* ── Board ── */}
        {loading ? (
          <div className="overflow-x-auto pb-1"><BoardSkeleton /></div>
        ) : (
          <div className="overflow-x-auto pb-1">
            <div className="flex min-w-max gap-2.5">
              {STATUSES.map((status, colIdx) => {
                const items = byStatus[status] || [];
                const s = getStatusStyle(status);
                return (
                  <section
                    key={status}
                    className={`w-[280px] shrink-0 rounded-2xl border border-zinc-100 bg-zinc-50/80 transition-colors animate-fadeInUp ${mobileStatus === status ? "block" : "hidden md:block"
                      } ${draggingLead ? "ring-2 ring-transparent hover:ring-blue-300" : ""}`}
                    style={{ animationDelay: `${colIdx * 60}ms` }}
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("!bg-blue-50/50"); }}
                    onDragLeave={(e) => { e.currentTarget.classList.remove("!bg-blue-50/50"); }}
                    onDrop={(e) => { e.currentTarget.classList.remove("!bg-blue-50/50"); onDrop(status); }}
                  >
                    {/* Column header */}
                    <div className="sticky top-0 z-10 overflow-hidden rounded-t-2xl border-b border-zinc-100 bg-white">
                      <div className={`h-1 bg-gradient-to-r ${s.gradient}`} />
                      <div className="flex items-center justify-between px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{s.icon}</span>
                          <p className="text-sm font-bold text-zinc-800">{STATUS_LABELS[status]}</p>
                        </div>
                        <span className={`inline-flex min-w-[24px] items-center justify-center rounded-full bg-gradient-to-r ${s.gradient} px-2 py-0.5 text-[11px] font-bold text-white shadow-sm`}>
                          {items.length}
                        </span>
                      </div>
                    </div>

                    {/* Cards */}
                    <div className="space-y-2 p-2">
                      {items.length === 0 ? (
                        <div className="rounded-xl border-2 border-dashed border-zinc-200 bg-white/60 px-3 py-8 text-center">
                          <p className="text-lg mb-1">📭</p>
                          <p className="text-xs text-zinc-400">Chưa có khách hàng</p>
                        </div>
                      ) : (
                        items.map((lead, idx) => (
                          <article
                            key={lead.id}
                            draggable
                            onDragStart={() => setDraggingLead(lead)}
                            onDragEnd={() => setDraggingLead(null)}
                            className="group overflow-hidden rounded-xl border border-zinc-100 bg-white shadow-sm transition-all hover:shadow-md hover:border-zinc-200 cursor-grab active:cursor-grabbing animate-fadeInUp"
                            style={{ animationDelay: `${colIdx * 60 + idx * 40}ms` }}
                          >
                            {/* Color accent */}
                            <div className={`h-0.5 bg-gradient-to-r ${s.gradient}`} />
                            <div className="p-2.5">
                              {/* Name + Phone */}
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-zinc-900">{lead.fullName || "Chưa có tên"}</p>
                                  <p className="text-xs font-mono text-zinc-500">{lead.phone || "-"}</p>
                                </div>
                                {lead.licenseType ? (
                                  <span className={`shrink-0 rounded-md ${s.bg} ${s.text} px-1.5 py-0.5 text-[10px] font-bold`}>
                                    {lead.licenseType}
                                  </span>
                                ) : null}
                              </div>

                              {/* Owner + Date */}
                              <div className="flex items-center gap-2 text-[11px] text-zinc-400 mb-2">
                                <span>👤 {lead.owner?.name || "-"}</span>
                                <span className="text-zinc-200">·</span>
                                <span>{formatDateTimeVi(lead.createdAt)}</span>
                              </div>

                              {/* Quick actions */}
                              <div className="flex items-center gap-1.5">
                                <Link
                                  href={`/leads/${lead.id}`}
                                  className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 px-2 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:shadow-md active:scale-95"
                                >
                                  👁️ Xem
                                </Link>
                                {canManageOwner ? (
                                  <button
                                    type="button"
                                    onClick={() => { setAssignLead(lead); setAssignOwnerId(lead.ownerId || ""); }}
                                    className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 px-2 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:shadow-md active:scale-95"
                                  >
                                    🔀 Gán
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => { setEventLeadId(lead.id); setEventOpen(true); }}
                                  className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-2 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:shadow-md active:scale-95"
                                >
                                  📋 SK
                                </button>
                                <div className="ml-auto">
                                  <Select
                                    value={lead.status}
                                    onChange={(e) => changeStatus(lead.id, lead.status, e.target.value)}
                                    disabled={updatingId === lead.id}
                                  >
                                    {STATUSES.map((st) => (
                                      <option key={st} value={st}>{STATUS_LABELS[st]}</option>
                                    ))}
                                  </Select>
                                </div>
                              </div>
                            </div>
                          </article>
                        ))
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        )}

        <MobileFiltersSheet
          open={filterOpen}
          onOpenChange={setFilterOpen}
          title="Bộ lọc bảng trạng thái"
          onApply={() => applyFiltersToUrl(filters)}
          onReset={() => {
            setFilters(EMPTY_FILTERS);
            applyFiltersToUrl(EMPTY_FILTERS);
          }}
        >
          <div className="space-y-4">
            <FilterCard title="Lọc nhanh">
              <div className="grid gap-2 md:grid-cols-2">
                <Input
                  value={filters.q}
                  placeholder="Tìm kiếm tên/SĐT"
                  onChange={(e) => setFilters((s) => ({ ...s, q: e.target.value }))}
                />
                <Input
                  value={filters.source}
                  placeholder="Nguồn"
                  onChange={(e) => setFilters((s) => ({ ...s, source: e.target.value }))}
                />
                <Input
                  value={filters.channel}
                  placeholder="Kênh"
                  onChange={(e) => setFilters((s) => ({ ...s, channel: e.target.value }))}
                />
                <Input
                  value={filters.licenseType}
                  placeholder="Hạng bằng"
                  onChange={(e) => setFilters((s) => ({ ...s, licenseType: e.target.value }))}
                />
                {canManageOwner ? (
                  <Select value={filters.ownerId} onChange={(e) => setFilters((s) => ({ ...s, ownerId: e.target.value }))}>
                    <option value="">Tất cả người phụ trách</option>
                    {owners.map((owner) => (
                      <option key={owner.id} value={owner.id}>
                        {owner.name || owner.email}
                      </option>
                    ))}
                  </Select>
                ) : !isTelesales ? (
                  <Input
                    value={filters.ownerId}
                    placeholder="Mã người phụ trách"
                    onChange={(e) => setFilters((s) => ({ ...s, ownerId: e.target.value }))}
                  />
                ) : null}
              </div>
            </FilterCard>

            <FilterCard title="Khoảng ngày">
              <div className="grid gap-2 md:grid-cols-2">
                <Input
                  type="date"
                  value={filters.createdFrom}
                  onChange={(e) => setFilters((s) => ({ ...s, createdFrom: e.target.value }))}
                />
                <Input
                  type="date"
                  value={filters.createdTo}
                  onChange={(e) => setFilters((s) => ({ ...s, createdTo: e.target.value }))}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    const today = dateYmdLocal(new Date());
                    setFilters((s) => ({ ...s, createdFrom: today, createdTo: today }));
                  }}
                >
                  Hôm nay
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    const now = new Date();
                    const start = new Date(now);
                    start.setDate(now.getDate() - 6);
                    setFilters((s) => ({ ...s, createdFrom: dateYmdLocal(start), createdTo: dateYmdLocal(now) }));
                  }}
                >
                  Tuần này
                </Button>
              </div>
            </FilterCard>

          </div>
        </MobileFiltersSheet>

        <Modal
          open={eventOpen}
          title="Thêm sự kiện khách hàng"
          description="Ghi nhận tương tác để cập nhật timeline xử lý lead"
          onClose={() => setEventOpen(false)}
        >
          <div className="space-y-3">
            <Select value={eventType} onChange={(e) => setEventType(e.target.value)}>
              {EVENT_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {STATUS_LABELS[t] || t}
                </option>
              ))}
            </Select>
            <Input placeholder="Ghi chú" value={eventNote} onChange={(e) => setEventNote(e.target.value)} />
            <Input
              placeholder="Dữ liệu JSON (không bắt buộc)"
              value={eventMeta}
              onChange={(e) => setEventMeta(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEventOpen(false)}>
                Hủy
              </Button>
              <Button onClick={submitEvent} disabled={eventSaving}>
                {eventSaving ? (
                  <span className="flex items-center gap-2">
                    <Spinner /> Đang lưu...
                  </span>
                ) : (
                  "Lưu sự kiện"
                )}
              </Button>
            </div>
          </div>
        </Modal>

        <Modal
          open={Boolean(assignLead)}
          title="Gán telesale phụ trách"
          description="Cập nhật người chịu trách nhiệm chính cho lead"
          onClose={() => setAssignLead(null)}
        >
          <div className="space-y-3">
            <p className="text-sm text-zinc-700">{assignLead ? `Khách hàng: ${assignLead.fullName || assignLead.id}` : ""}</p>
            <Select value={assignOwnerId} onChange={(e) => setAssignOwnerId(e.target.value)}>
              <option value="">Chưa gán</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name || owner.email}
                </option>
              ))}
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setAssignLead(null)}>
                Hủy
              </Button>
              <Button onClick={submitAssignOwner} disabled={assignSaving}>
                {assignSaving ? "Đang lưu..." : "Lưu"}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </MobileShell>
  );
}
