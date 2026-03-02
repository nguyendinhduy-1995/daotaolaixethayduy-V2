"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, fetchMe, getToken } from "@/lib/auth-client";
import { isAdminRole, isTelesalesRole } from "@/lib/admin-auth";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table } from "@/components/ui/table";
import { DataTable } from "@/components/ui/data-table";
import { FilterCard } from "@/components/ui/filter-card";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { MobileFiltersSheet } from "@/components/mobile/MobileFiltersSheet";
import { MobileToolbar } from "@/components/app/mobile-toolbar";
import { MobileShell } from "@/components/mobile/MobileShell";
import { SuggestedChecklist } from "@/components/mobile/SuggestedChecklist";
import { formatDateTimeVi } from "@/lib/date-utils";
import { hasUiPermission } from "@/lib/ui-permissions";

type Lead = {
  id: string;
  fullName: string | null;
  phone: string | null;
  province: string | null;
  licenseType: string | null;
  source: string | null;
  channel: string | null;
  status: string;
  ownerId: string | null;
  note: string | null;
  tags: string[];
  formSubmitCount?: number;
  lastContactAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { events: number };
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
  page: number;
  pageSize: number;
  total: number;
  statusCounts?: Record<string, number>;
};

type LeadDetailResponse = { lead: Lead };
type LeadEvent = {
  id: string;
  leadId: string;
  type: string;
  payload?: unknown;
  createdAt: string;
  createdById?: string | null;
};
type LeadEventsResponse = { items: LeadEvent[] };
type UserOption = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isActive: boolean;
};
type UsersResponse = { items: UserOption[] };

const STATUS_OPTIONS = ["NEW", "HAS_PHONE", "APPOINTED", "ARRIVED", "SIGNED", "STUDYING", "EXAMED", "RESULT", "LOST"];
const EVENT_OPTIONS = [...STATUS_OPTIONS, "CALLED"];

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
  CALLED: "Đã gọi",
};

const STATUS_STYLE: Record<string, { icon: string; bg: string; text: string; border: string; gradient: string }> = {
  NEW: { icon: "🆕", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", gradient: "from-blue-500 to-cyan-500" },
  HAS_PHONE: { icon: "📱", bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200", gradient: "from-teal-500 to-emerald-500" },
  APPOINTED: { icon: "📅", bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", gradient: "from-orange-500 to-amber-500" },
  ARRIVED: { icon: "🏢", bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", gradient: "from-purple-500 to-violet-500" },
  SIGNED: { icon: "✍️", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", gradient: "from-emerald-500 to-green-600" },
  STUDYING: { icon: "📚", bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", gradient: "from-indigo-500 to-blue-600" },
  EXAMED: { icon: "📝", bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200", gradient: "from-sky-500 to-blue-500" },
  RESULT: { icon: "🏆", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", gradient: "from-amber-500 to-yellow-500" },
  LOST: { icon: "❌", bg: "bg-red-50", text: "text-red-700", border: "border-red-200", gradient: "from-red-500 to-rose-500" },
  CALLED: { icon: "📞", bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200", gradient: "from-cyan-500 to-teal-500" },
};

function statusStyle(status: string) {
  return STATUS_STYLE[status] || STATUS_STYLE.NEW;
}

/** Format relative time in Vietnamese: '5 phút trước', '2 giờ trước', '3 ngày trước' */
function relativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return "vừa xong";
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  return `${Math.floor(days / 30)} tháng trước`;
}

function LeadsSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-zinc-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 rounded bg-zinc-200" />
              <div className="h-3 w-1/2 rounded bg-zinc-100" />
            </div>
            <div className="h-6 w-16 rounded-full bg-zinc-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

type Filters = {
  status: string;
  source: string;
  channel: string;
  licenseType: string;
  ownerId: string;
  q: string;
  createdFrom: string;
  createdTo: string;
};

const INITIAL_FILTERS: Filters = {
  status: "",
  source: "",
  channel: "",
  licenseType: "",
  ownerId: "",
  q: "",
  createdFrom: "",
  createdTo: "",
};

function formatError(err: ApiClientError) {
  return `${err.code}: ${err.message}`;
}

export default function LeadsPage() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState("desc");
  const [qInput, setQInput] = useState("");
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);

  // Debounce search input → filters.q (300ms)
  const qTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    qTimer.current = setTimeout(() => {
      setFilters((prev) => {
        if (prev.q === qInput) return prev;
        return { ...prev, q: qInput };
      });
      setPage(1);
    }, 300);
    return () => clearTimeout(qTimer.current);
  }, [qInput]);

  // Helper: update a single filter field (auto-apply)
  const setFilter = useCallback(<K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [canManageOwner, setCanManageOwner] = useState(false);
  const [isTelesales, setIsTelesales] = useState(false);
  const [canCreateLead, setCanCreateLead] = useState(false);
  const [canDeleteLead, setCanDeleteLead] = useState(false);
  const [owners, setOwners] = useState<UserOption[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [createForm, setCreateForm] = useState({
    fullName: "",
    phone: "",
    source: "manual",
    channel: "manual",
    licenseType: "",
  });

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [detailEvents, setDetailEvents] = useState<LeadEvent[]>([]);
  const [detailError, setDetailError] = useState("");

  const [eventLeadId, setEventLeadId] = useState("");
  const [eventOpen, setEventOpen] = useState(false);
  const [eventSaving, setEventSaving] = useState(false);
  const [eventForm, setEventForm] = useState({ type: "CALLED", note: "", meta: "" });

  const [pendingStatus, setPendingStatus] = useState<{ id: string; status: string } | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [assignLead, setAssignLead] = useState<Lead | null>(null);
  const [assignOwnerId, setAssignOwnerId] = useState("");
  const [assignSaving, setAssignSaving] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mobileActionLead, setMobileActionLead] = useState<Lead | null>(null);

  // Edit lead state
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({ fullName: "", phone: "", province: "", licenseType: "", source: "", channel: "", note: "" });
  const [editLeadId, setEditLeadId] = useState("");

  // Delete lead state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteLeadId, setDeleteLeadId] = useState("");
  const [deleteLeadName, setDeleteLeadName] = useState("");

  // Uncalled leads
  const [uncalledLeads, setUncalledLeads] = useState<Lead[]>([]);
  const [uncalledExpanded, setUncalledExpanded] = useState(true);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    params.set("sort", sort);
    params.set("order", order);
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    return params.toString();
  }, [page, pageSize, sort, order, filters]);

  const handleAuthError = useCallback((err: ApiClientError) => {
    if (err.code === "AUTH_MISSING_BEARER" || err.code === "AUTH_INVALID_TOKEN") {
      clearToken();
      router.replace("/login");
      return true;
    }
    return false;
  }, [router]);

  const loadLeads = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [data, uncalledData] = await Promise.all([
        fetchJson<LeadListResponse>(`/api/leads?${query}`, { token }),
        fetchJson<LeadListResponse>(`/api/leads?page=1&pageSize=20&sort=createdAt&order=desc&noCalled=true`, { token }).catch(() => ({ items: [] as Lead[], total: 0 })),
      ]);
      setItems(data.items);
      setTotal(data.total);
      if (data.statusCounts) setStatusCounts(data.statusCounts);
      setUncalledLeads(uncalledData.items || []);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(formatError(err));
    } finally {
      setLoading(false);
    }
  }, [handleAuthError, query]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  useEffect(() => {
    fetchMe()
      .then((data) => {
        setCanManageOwner(isAdminRole(data.user.role));
        setIsTelesales(isTelesalesRole(data.user.role));
        setCanCreateLead(hasUiPermission(data.user.permissions, "leads", "CREATE"));
        setCanDeleteLead(isAdminRole(data.user.role) && hasUiPermission(data.user.permissions, "leads", "DELETE"));
      })
      .catch(() => {
        setCanManageOwner(false);
        setIsTelesales(false);
        setCanCreateLead(false);
        setCanDeleteLead(false);
      });
  }, []);

  useEffect(() => {
    if (searchParams.get("err") === "forbidden") {
      setError("AUTH_FORBIDDEN: Bạn không có quyền truy cập trang quản trị.");
    }
  }, [searchParams]);

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

  async function openDetail(id: string) {
    const token = getToken();
    if (!token) return;
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError("");
    setDetailEvents([]);
    try {
      const [leadRes, eventsRes] = await Promise.all([
        fetchJson<LeadDetailResponse>(`/api/leads/${id}`, { token }),
        fetchJson<LeadEventsResponse>(`/api/leads/${id}/events`, { token }).catch(() => ({ items: [] })),
      ]);
      setDetailLead(leadRes.lead);
      setDetailEvents(eventsRes.items || []);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setDetailError(formatError(err));
    } finally {
      setDetailLoading(false);
    }
  }

  function validateCreateForm() {
    const errs: Record<string, string> = {};
    if (!createForm.fullName.trim()) errs.fullName = "Vui lòng nhập họ tên";
    const digits = createForm.phone.replace(/\D/g, "");
    if (digits && (digits.length !== 10 || !digits.startsWith("0"))) {
      errs.phone = "SĐT phải gồm 10 số, bắt đầu bằng 0";
    }
    setCreateErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function createLead() {
    if (!validateCreateForm()) return;
    const token = getToken();
    if (!token) return;
    setCreateSaving(true);
    setError("");
    try {
      await fetchJson("/api/leads", {
        method: "POST",
        token,
        body: {
          fullName: createForm.fullName.trim() || null,
          phone: createForm.phone.replace(/\D/g, "") || null,
          source: createForm.source || null,
          channel: createForm.channel || null,
          licenseType: createForm.licenseType || null,
        },
      });
      setCreateOpen(false);
      setCreateForm({ fullName: "", phone: "", source: "manual", channel: "manual", licenseType: "" });
      setCreateErrors({});
      toast.success("Tạo khách hàng thành công!");
      await loadLeads();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(formatError(err));
    } finally {
      setCreateSaving(false);
    }
  }

  async function confirmStatusChange() {
    if (!pendingStatus) return;
    const token = getToken();
    if (!token) return;

    // Optimistic: update local state immediately
    const prevItems = [...items];
    setItems((prev) => prev.map((l) => (l.id === pendingStatus.id ? { ...l, status: pendingStatus.status } : l)));
    const updatedId = pendingStatus.id;
    const newStatus = pendingStatus.status;
    setPendingStatus(null);
    setStatusSaving(true);

    try {
      await fetchJson(`/api/leads/${updatedId}`, {
        method: "PATCH",
        token,
        body: { status: newStatus },
      });
      toast.success(`Cập nhật → ${STATUS_LABELS[newStatus] || newStatus}`);
      if (detailLead?.id === updatedId) openDetail(updatedId);
    } catch (e) {
      // Revert on failure
      setItems(prevItems);
      const err = e as ApiClientError;
      if (!handleAuthError(err)) toast.error(formatError(err));
    } finally {
      setStatusSaving(false);
    }
  }

  async function addEvent(leadIdOverride?: string) {
    const leadId = leadIdOverride || eventLeadId;
    if (!leadId) return;
    const token = getToken();
    if (!token) return;
    setEventSaving(true);
    try {
      const meta = eventForm.meta.trim() ? JSON.parse(eventForm.meta) : undefined;
      await fetchJson(`/api/leads/${leadId}/events`, {
        method: "POST",
        token,
        body: { type: eventForm.type, note: eventForm.note || undefined, meta },
      });
      setEventForm({ type: "CALLED", note: "", meta: "" });
      setEventOpen(false);
      setEventLeadId("");
      toast.success(`Đã thêm sự kiện ${STATUS_LABELS[eventForm.type] || eventForm.type}`);
      await loadLeads();
      if (detailLead?.id === leadId) openDetail(leadId);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setDetailError(formatError(err));
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
      const updatedId = assignLead.id;
      setAssignLead(null);
      setAssignOwnerId("");
      await loadLeads();
      if (detailLead?.id === updatedId) openDetail(updatedId);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(formatError(err));
    } finally {
      setAssignSaving(false);
    }
  }

  function openEditLead(lead: Lead) {
    setEditLeadId(lead.id);
    setEditForm({
      fullName: lead.fullName || "",
      phone: lead.phone || "",
      province: lead.province || "",
      licenseType: lead.licenseType || "",
      source: lead.source || "",
      channel: lead.channel || "",
      note: lead.note || "",
    });
    setEditOpen(true);
  }

  async function saveEditLead() {
    if (!editLeadId) return;
    const token = getToken();
    if (!token) return;
    setEditSaving(true);
    setError("");
    try {
      await fetchJson(`/api/leads/${editLeadId}`, {
        method: "PATCH",
        token,
        body: {
          fullName: editForm.fullName.trim() || null,
          phone: editForm.phone.replace(/\D/g, "") || null,
          province: editForm.province.trim() || null,
          licenseType: editForm.licenseType.trim() || null,
          source: editForm.source.trim() || null,
          channel: editForm.channel.trim() || null,
          note: editForm.note.trim() || null,
        },
      });
      setEditOpen(false);
      toast.success("Đã cập nhật khách hàng.");
      await loadLeads();
      if (detailLead?.id === editLeadId) openDetail(editLeadId);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(formatError(err));
    } finally {
      setEditSaving(false);
    }
  }

  function openDeleteLead(lead: Lead) {
    setDeleteLeadId(lead.id);
    setDeleteLeadName(lead.fullName || lead.phone || lead.id);
    setDeleteOpen(true);
  }

  async function confirmDeleteLead() {
    if (!deleteLeadId) return;
    const token = getToken();
    if (!token) return;
    setDeleteSaving(true);
    setError("");
    try {
      await fetchJson(`/api/leads/${deleteLeadId}`, { method: "DELETE", token });
      setDeleteOpen(false);
      setDetailOpen(false);
      toast.success("Đã xóa khách hàng.");
      await loadLeads();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) {
        setError(formatError(err));
        toast.error(formatError(err));
      }
    } finally {
      setDeleteSaving(false);
    }
  }

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <MobileShell
      title="Khách hàng"
      subtitle="Danh sách và chuyển đổi trạng thái"
      rightAction={
        canCreateLead ? (
          <button
            type="button"
            className="tap-feedback rounded-xl border border-zinc-200 bg-white/80 px-3 py-2 text-xs font-medium text-zinc-700"
            onClick={() => setCreateOpen(true)}
          >
            + Thêm
          </button>
        ) : null
      }
    >
      <div className="space-y-4 pb-24 md:pb-0">

        {/* ── Premium Header ── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 p-4 text-white shadow-lg shadow-blue-200 animate-fadeInUp">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/10 blur-xl" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-2xl backdrop-blur-sm">👥</div>
            <div className="flex-1">
              <h2 className="text-lg font-bold">Khách hàng</h2>
              <p className="text-sm text-white/80">Quản lý dữ liệu & theo dõi chuyển đổi</p>
            </div>
            {canCreateLead ? (
              <Button onClick={() => setCreateOpen(true)} className="hidden md:inline-flex !bg-white/20 !text-white hover:!bg-white/30 backdrop-blur-sm">
                + Tạo mới
              </Button>
            ) : null}
          </div>
          {/* Status summary mini chips – uses server-side totals */}
          <div className="relative mt-3 flex flex-wrap gap-1.5">
            {Object.keys(statusCounts).length > 0 ? (
              Object.entries(statusCounts)
                .sort(([a], [b]) => STATUS_OPTIONS.indexOf(a) - STATUS_OPTIONS.indexOf(b))
                .map(([st, cnt]) => {
                  const s = statusStyle(st);
                  return (
                    <span key={st} className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
                      {s.icon} {STATUS_LABELS[st] || st}: {cnt}
                    </span>
                  );
                })
            ) : null}
          </div>
        </div>

        {/* ── Chưa gọi card ── */}
        {uncalledLeads.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-red-200 bg-gradient-to-br from-red-50 via-orange-50 to-amber-50 shadow-sm animate-fadeInUp">
            <button
              type="button"
              onClick={() => setUncalledExpanded((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-orange-500 text-lg text-white shadow-sm">📞</span>
                <div>
                  <p className="text-sm font-bold text-red-800">Chưa gọi ({uncalledLeads.length})</p>
                  <p className="text-xs text-red-600/70">Khách hàng mới cần liên hệ</p>
                </div>
              </div>
              <span className={`text-red-400 transition-transform duration-200 ${uncalledExpanded ? "rotate-0" : "-rotate-90"}`}>▾</span>
            </button>
            {uncalledExpanded ? (
              <div className="space-y-1.5 px-3 pb-3">
                {uncalledLeads.slice(0, 5).map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center gap-3 rounded-xl border border-red-100 bg-white px-3 py-2.5 shadow-sm transition hover:shadow-md"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-sm">🆕</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-zinc-900">{lead.fullName || "Chưa có tên"}</p>
                      <p className="text-xs font-mono text-zinc-500">{lead.phone || "—"}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {lead.phone ? (
                        <a
                          href={`tel:${lead.phone}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm transition hover:shadow-md active:scale-95"
                        >
                          📞 Gọi
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => openDetail(lead.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm transition hover:shadow-md active:scale-95"
                      >
                        👁️ Xem
                      </button>
                    </div>
                  </div>
                ))}
                {uncalledLeads.length > 5 ? (
                  <p className="pt-1 text-center text-xs text-red-500/70">
                    và {uncalledLeads.length - 5} khách nữa...
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? <Alert type="error" message={error} /> : null}
        <SuggestedChecklist
          storageKey="leads-mobile-checklist"
          items={[
            { id: "search", label: "Rà khách mới theo từ khóa", hint: "Ưu tiên khách phát sinh hôm nay" },
            { id: "assign", label: "Gán phụ trách khách mới", hint: "Giảm khách chưa owner", actionHref: "/admin/assign-leads", actionLabel: "Mở" },
            { id: "event", label: "Cập nhật sự kiện gọi/hẹn", hint: "Giữ pipeline sạch và đúng trạng thái" },
          ]}
        />

        <div className="sticky top-[116px] z-20 rounded-2xl border border-zinc-200 bg-zinc-100/90 p-2 backdrop-blur md:hidden">
          <MobileToolbar
            value={qInput}
            onChange={(value) => setQInput(value)}
            onOpenFilter={() => setMobileFilterOpen(true)}
            activeFilterCount={activeFilterCount}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {filters.q ? <Badge text={`Từ khóa: ${filters.q}`} tone="primary" /> : null}
            {filters.status ? <Badge text={`Trạng thái: ${STATUS_LABELS[filters.status] || filters.status}`} tone="accent" /> : null}
            {filters.source ? <Badge text={`Nguồn: ${filters.source}`} tone="neutral" /> : null}
          </div>
        </div>

        <div className="hidden md:block">
          <FilterCard
            actions={
              <Button
                variant="secondary"
                onClick={() => {
                  setQInput("");
                  setFilters(INITIAL_FILTERS);
                  setPage(1);
                }}
              >
                Làm mới
              </Button>
            }
          >
            <div className="grid gap-2 md:grid-cols-4">
              <Input
                placeholder="Tìm kiếm tên/SĐT"
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
              />
              <Select
                value={filters.status}
                onChange={(e) => setFilter("status", e.target.value)}
              >
                <option value="">Tất cả trạng thái</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status] || status}
                  </option>
                ))}
              </Select>
              <Input
                placeholder="Nguồn"
                value={filters.source}
                onChange={(e) => setFilter("source", e.target.value)}
              />
              <Input
                placeholder="Kênh"
                value={filters.channel}
                onChange={(e) => setFilter("channel", e.target.value)}
              />
              <Input
                placeholder="Hạng bằng"
                value={filters.licenseType}
                onChange={(e) => setFilter("licenseType", e.target.value)}
              />
              {canManageOwner ? (
                <Select
                  value={filters.ownerId}
                  onChange={(e) => setFilter("ownerId", e.target.value)}
                >
                  <option value="">Tất cả người phụ trách</option>
                  {owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.name || owner.email}
                    </option>
                  ))}
                </Select>
              ) : !isTelesales ? (
                <Input
                  placeholder="Mã người phụ trách"
                  value={filters.ownerId}
                  onChange={(e) => setFilter("ownerId", e.target.value)}
                />
              ) : null}
              <Input
                type="date"
                value={filters.createdFrom}
                onChange={(e) => setFilter("createdFrom", e.target.value)}
              />
              <Input
                type="date"
                value={filters.createdTo}
                onChange={(e) => setFilter("createdTo", e.target.value)}
              />
              <div className="flex flex-wrap items-center gap-2 md:col-span-4">
                <Select value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="createdAt">Sắp xếp: Ngày tạo</option>
                  <option value="updatedAt">Sắp xếp: Cập nhật</option>
                  <option value="lastContactAt">Sắp xếp: Liên hệ gần nhất</option>
                </Select>
                <Select value={order} onChange={(e) => setOrder(e.target.value)}>
                  <option value="desc">Thứ tự: Mới đến cũ</option>
                  <option value="asc">Thứ tự: Cũ đến mới</option>
                </Select>
                <Select
                  value={String(pageSize)}
                  onChange={(e) => {
                    setPage(1);
                    setPageSize(Number(e.target.value));
                  }}
                >
                  <option value="20">20 / trang</option>
                  <option value="50">50 / trang</option>
                  <option value="100">100 / trang</option>
                </Select>
              </div>
            </div>
          </FilterCard>
        </div>

        <div className="space-y-2 md:hidden">
          {loading ? (
            <LeadsSkeleton />
          ) : items.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-white p-8 text-center animate-fadeInUp">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-2xl">📭</div>
              <p className="font-medium text-zinc-700">Không có khách hàng</p>
              <p className="mt-1 text-sm text-zinc-500">Thử nới bộ lọc hoặc tạo khách hàng mới.</p>
            </div>
          ) : (
            items.map((lead, idx) => {
              const s = statusStyle(lead.status);
              const callCount = lead._count?.events ?? 0;
              return (
                <div
                  key={lead.id}
                  className="group relative overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm transition-all hover:shadow-md animate-fadeInUp"
                  style={{ animationDelay: `${Math.min(idx * 60, 400)}ms` }}
                >
                  <div className={`h-1 bg-gradient-to-r ${s.gradient}`} />
                  <div className="p-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${s.bg} text-lg`}>{s.icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-bold text-zinc-900">{lead.fullName || "Chưa có tên"}</p>
                        <p className="text-xs text-zinc-500 font-mono">{lead.phone || "Chưa có SĐT"}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`inline-flex items-center gap-1 rounded-full ${s.bg} ${s.text} border ${s.border} px-2 py-0.5 text-xs font-bold`}>
                          {STATUS_LABELS[lead.status] || lead.status}
                        </span>
                        {callCount > 0 ? (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 px-1.5 py-0.5 text-[10px] font-bold">
                            📞 {callCount}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 text-[10px] font-bold">
                            ⚠️ Chưa gọi
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-zinc-500">
                      <p>📡 {lead.source || "-"} · {lead.channel || "-"}</p>
                      <p>👤 {lead.owner?.name || lead.owner?.email || "-"}</p>
                      <p>📅 {formatDateTimeVi(lead.createdAt)}</p>
                      {lead.lastContactAt ? (
                        <p className="text-cyan-600 font-medium">🕐 {relativeTime(lead.lastContactAt)}</p>
                      ) : null}
                      {(lead.formSubmitCount ?? 0) > 1 ? (
                        <p className="font-semibold text-orange-600">📝 Gửi form: {lead.formSubmitCount} lần</p>
                      ) : null}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      {lead.phone ? (
                        <a
                          href={`tel:${lead.phone}`}
                          className="inline-flex items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:shadow-md active:scale-95"
                        >
                          📞 Gọi
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => openDetail(lead.id)}
                        className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:shadow-md active:scale-95"
                      >
                        👁️ Chi tiết
                      </button>
                      <button
                        type="button"
                        onClick={() => setMobileActionLead(lead)}
                        className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 transition-all hover:bg-zinc-50 active:scale-95"
                      >
                        ⋯
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="hidden md:block">
          <DataTable
            loading={loading}
            isEmpty={!loading && items.length === 0}
            emptyText="Không có dữ liệu khách hàng."
          >
            <Table headers={["Khách hàng", "SĐT", "Trạng thái", "Cuộc gọi", "Liên hệ cuối", "Người phụ trách", "Nguồn", "Hành động"]}>
              {items.map((lead) => {
                const s = statusStyle(lead.status);
                const callCount = lead._count?.events ?? 0;
                return (
                  <tr key={lead.id} className="transition-colors hover:bg-zinc-50">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${s.bg} text-sm`}>{s.icon}</span>
                        <div>
                          <div className="font-medium text-zinc-900">{lead.fullName || "Chưa có tên"}</div>
                          <div className="text-[11px] text-zinc-400 font-mono">{lead.id.slice(0, 8)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-sm">{lead.phone || "-"}</span>
                        {lead.phone ? (
                          <a
                            href={`tel:${lead.phone}`}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-green-100 text-green-700 text-xs transition hover:bg-green-200"
                            title="Gọi"
                          >
                            📞
                          </a>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 rounded-full ${s.bg} ${s.text} border ${s.border} px-2 py-0.5 text-xs font-bold`}>
                        {s.icon} {STATUS_LABELS[lead.status] || lead.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {callCount > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 px-2 py-0.5 text-xs font-bold">
                          📞 {callCount}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 text-[11px] font-bold">
                          ⚠️ Chưa gọi
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {lead.lastContactAt ? (
                        <span className="text-cyan-600 font-medium">🕐 {relativeTime(lead.lastContactAt)}</span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-600">{lead.owner?.name || lead.owner?.email || "-"}</td>
                    <td className="px-3 py-2">
                      <div className="text-sm">{lead.source || "-"}</div>
                      <div className="text-xs text-zinc-500">{lead.channel || "-"}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => openDetail(lead.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:shadow-md hover:from-blue-600 hover:to-cyan-600 active:scale-95"
                        >
                          👁️ Xem
                        </button>
                        {canManageOwner ? (
                          <button
                            type="button"
                            onClick={() => {
                              setAssignLead(lead);
                              setAssignOwnerId(lead.ownerId || "");
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:shadow-md hover:from-violet-600 hover:to-purple-600 active:scale-95"
                          >
                            🔀 Gán
                          </button>
                        ) : null}
                        <Select
                          value={lead.status}
                          onChange={(e) => setPendingStatus({ id: lead.id, status: e.target.value })}
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {STATUS_LABELS[status] || status}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </Table>
          </DataTable>
        </div>

        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />

        <MobileFiltersSheet
          open={mobileFilterOpen}
          onOpenChange={setMobileFilterOpen}
          title="Bộ lọc khách hàng"
          onApply={() => setMobileFilterOpen(false)}
          onReset={() => {
            setQInput("");
            setFilters(INITIAL_FILTERS);
            setPage(1);
          }}
        >
          <div className="space-y-3">
            <Input
              placeholder="Tìm kiếm tên/SĐT"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
            />
            <Select
              value={filters.status}
              onChange={(e) => setFilter("status", e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status] || status}
                </option>
              ))}
            </Select>
            <Input
              placeholder="Nguồn"
              value={filters.source}
              onChange={(e) => setFilter("source", e.target.value)}
            />
            <Input
              placeholder="Kênh"
              value={filters.channel}
              onChange={(e) => setFilter("channel", e.target.value)}
            />
            <Input
              placeholder="Hạng bằng"
              value={filters.licenseType}
              onChange={(e) => setFilter("licenseType", e.target.value)}
            />
            {canManageOwner ? (
              <Select
                value={filters.ownerId}
                onChange={(e) => setFilter("ownerId", e.target.value)}
              >
                <option value="">Tất cả người phụ trách</option>
                {owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name || owner.email}
                  </option>
                ))}
              </Select>
            ) : !isTelesales ? (
              <Input
                placeholder="Mã người phụ trách"
                value={filters.ownerId}
                onChange={(e) => setFilter("ownerId", e.target.value)}
              />
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={filters.createdFrom}
                onChange={(e) => setFilter("createdFrom", e.target.value)}
              />
              <Input
                type="date"
                value={filters.createdTo}
                onChange={(e) => setFilter("createdTo", e.target.value)}
              />
            </div>
            <Select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="createdAt">Sắp xếp: Ngày tạo</option>
              <option value="updatedAt">Sắp xếp: Cập nhật</option>
              <option value="lastContactAt">Sắp xếp: Liên hệ gần nhất</option>
            </Select>
            <Select value={order} onChange={(e) => setOrder(e.target.value)}>
              <option value="desc">Thứ tự: Mới đến cũ</option>
              <option value="asc">Thứ tự: Cũ đến mới</option>
            </Select>
            <Select
              value={String(pageSize)}
              onChange={(e) => {
                setPage(1);
                setPageSize(Number(e.target.value));
              }}
            >
              <option value="20">20 / trang</option>
              <option value="50">50 / trang</option>
              <option value="100">100 / trang</option>
            </Select>
          </div>
        </MobileFiltersSheet>

        <BottomSheet
          open={Boolean(mobileActionLead)}
          onOpenChange={(open) => {
            if (!open) setMobileActionLead(null);
          }}
          title="Hành động khách hàng"
        >
          <div className="space-y-2">
            {mobileActionLead ? (
              <div className="flex items-center gap-2 pb-1">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${statusStyle(mobileActionLead.status).bg} text-sm`}>{statusStyle(mobileActionLead.status).icon}</span>
                <div>
                  <p className="text-sm font-bold text-zinc-900">{mobileActionLead.fullName || "Chưa có tên"}</p>
                  <p className="text-xs text-zinc-500 font-mono">{mobileActionLead.phone || ""}</p>
                </div>
              </div>
            ) : null}
            {canManageOwner ? (
              <button
                type="button"
                className="w-full flex items-center gap-3 rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 px-4 py-3 text-sm font-medium text-violet-700 transition-all hover:shadow-md active:scale-[0.98]"
                onClick={() => {
                  if (!mobileActionLead) return;
                  setAssignLead(mobileActionLead);
                  setAssignOwnerId(mobileActionLead.ownerId || "");
                  setMobileActionLead(null);
                }}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white text-sm">🔀</span>
                Gán telesale phụ trách
              </button>
            ) : null}
            <button
              type="button"
              className="w-full flex items-center gap-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 px-4 py-3 text-sm font-medium text-amber-700 transition-all hover:shadow-md active:scale-[0.98]"
              onClick={() => {
                if (!mobileActionLead) return;
                openEditLead(mobileActionLead);
                setMobileActionLead(null);
              }}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white text-sm">✏️</span>
              Sửa thông tin
            </button>
            <button
              type="button"
              className="w-full flex items-center gap-3 rounded-xl bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 px-4 py-3 text-sm font-medium text-blue-700 transition-all hover:shadow-md active:scale-[0.98]"
              onClick={() => {
                if (!mobileActionLead) return;
                setEventLeadId(mobileActionLead.id);
                setEventOpen(true);
                setMobileActionLead(null);
              }}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 text-white text-sm">📋</span>
              Thêm sự kiện
            </button>
            {canDeleteLead ? (
              <button
                type="button"
                className="w-full flex items-center gap-3 rounded-xl bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 px-4 py-3 text-sm font-medium text-red-600 transition-all hover:shadow-md active:scale-[0.98]"
                onClick={() => {
                  if (!mobileActionLead) return;
                  openDeleteLead(mobileActionLead);
                  setMobileActionLead(null);
                }}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-rose-600 text-white text-sm">🗑️</span>
                Xóa khách hàng
              </button>
            ) : null}
            <Select
              value={mobileActionLead?.status || ""}
              onChange={(e) => {
                if (!mobileActionLead) return;
                setPendingStatus({ id: mobileActionLead.id, status: e.target.value });
                setMobileActionLead(null);
              }}
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status] || status}
                </option>
              ))}
            </Select>
            <Link
              href={mobileActionLead ? `/leads/${mobileActionLead.id}` : "#"}
              className="inline-flex h-11 w-full items-center rounded-xl border border-zinc-200 px-4 text-sm font-medium text-zinc-700"
              onClick={() => setMobileActionLead(null)}
            >
              Mở trang chi tiết
            </Link>
          </div>
        </BottomSheet>

        <Modal
          open={createOpen}
          title="Tạo khách hàng"
          onClose={() => setCreateOpen(false)}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setCreateOpen(false)}>
                Huỷ
              </Button>
              <Button onClick={createLead} disabled={createSaving}>
                {createSaving ? "Đang tạo..." : "Tạo mới"}
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <div>
              <Input
                placeholder="Họ và tên *"
                value={createForm.fullName}
                onChange={(e) => { setCreateForm((s) => ({ ...s, fullName: e.target.value })); setCreateErrors((e2) => ({ ...e2, fullName: "" })); }}
              />
              {createErrors.fullName ? <p className="mt-1 text-xs text-red-500">{createErrors.fullName}</p> : null}
            </div>
            <div>
              <Input
                placeholder="SĐT (không bắt buộc)"
                value={createForm.phone}
                inputMode="tel"
                onChange={(e) => { setCreateForm((s) => ({ ...s, phone: e.target.value })); setCreateErrors((e2) => ({ ...e2, phone: "" })); }}
              />
              {createErrors.phone ? <p className="mt-1 text-xs text-red-500">{createErrors.phone}</p> : null}
            </div>
            <Input placeholder="Nguồn" value={createForm.source} onChange={(e) => setCreateForm((s) => ({ ...s, source: e.target.value }))} />
            <Input placeholder="Kênh" value={createForm.channel} onChange={(e) => setCreateForm((s) => ({ ...s, channel: e.target.value }))} />
            <Input placeholder="Hạng bằng" value={createForm.licenseType} onChange={(e) => setCreateForm((s) => ({ ...s, licenseType: e.target.value }))} />
          </div>
        </Modal>

        <Modal
          open={Boolean(pendingStatus)}
          title="Xác nhận cập nhật trạng thái"
          onClose={() => setPendingStatus(null)}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPendingStatus(null)}>
                Huỷ
              </Button>
              <Button onClick={confirmStatusChange} disabled={statusSaving}>
                {statusSaving ? "Đang cập nhật..." : "Xác nhận"}
              </Button>
            </div>
          }
        >
          <p className="text-sm text-zinc-700">
            {pendingStatus ? `Bạn chắc chắn muốn cập nhật trạng thái thành ${STATUS_LABELS[pendingStatus.status] || pendingStatus.status}?` : ""}
          </p>
        </Modal>

        <Modal
          open={eventOpen}
          title="Thêm sự kiện"
          onClose={() => setEventOpen(false)}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEventOpen(false)}>
                Hủy
              </Button>
              <Button onClick={() => addEvent()} disabled={eventSaving}>
                {eventSaving ? "Đang lưu..." : "Lưu sự kiện"}
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <Select value={eventForm.type} onChange={(e) => setEventForm((s) => ({ ...s, type: e.target.value }))}>
              {EVENT_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {STATUS_LABELS[type] || type}
                </option>
              ))}
            </Select>
            <Input placeholder="Ghi chú" value={eventForm.note} onChange={(e) => setEventForm((s) => ({ ...s, note: e.target.value }))} />
            <Input placeholder="Dữ liệu JSON (không bắt buộc)" value={eventForm.meta} onChange={(e) => setEventForm((s) => ({ ...s, meta: e.target.value }))} />
          </div>
        </Modal>

        <Modal open={detailOpen} title="Chi tiết khách hàng" onClose={() => setDetailOpen(false)}>
          {detailLoading ? (
            <div className="flex items-center gap-2 text-zinc-600">
              <Spinner /> Đang tải chi tiết...
            </div>
          ) : detailError ? (
            <Alert type="error" message={detailError} />
          ) : detailLead ? (
            <div className="space-y-4">
              {/* Lead info card */}
              <div className="overflow-hidden rounded-xl border border-zinc-100">
                <div className={`h-1.5 bg-gradient-to-r ${statusStyle(detailLead.status).gradient}`} />
                <div className="p-3">
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${statusStyle(detailLead.status).bg} text-lg`}>{statusStyle(detailLead.status).icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-zinc-900 truncate">{detailLead.fullName || "-"}</p>
                      <p className="text-xs text-zinc-500 font-mono">{detailLead.phone || "-"}</p>
                    </div>
                    {detailLead.phone ? (
                      <a
                        href={`tel:${detailLead.phone}`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:shadow-md active:scale-95"
                      >
                        📞 Gọi ngay
                      </a>
                    ) : null}
                  </div>
                  <div className="grid gap-1.5 text-sm md:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full ${statusStyle(detailLead.status).bg} ${statusStyle(detailLead.status).text} border ${statusStyle(detailLead.status).border} px-2.5 py-1 text-xs font-bold`}>
                        {statusStyle(detailLead.status).icon} {STATUS_LABELS[detailLead.status] || detailLead.status}
                      </span>
                    </div>
                    <div><span className="text-zinc-500">Nguồn:</span> {detailLead.source || "-"} · {detailLead.channel || "-"}</div>
                    <div><span className="text-zinc-500">Hạng bằng:</span> {detailLead.licenseType || "-"}</div>
                    <div><span className="text-zinc-500">Tỉnh thành:</span> {detailLead.province || "-"}</div>
                    <div><span className="text-zinc-500">Phụ trách:</span> {detailLead.owner?.name || detailLead.owner?.email || "-"}</div>
                    <div><span className="text-zinc-500">Ngày tạo:</span> {formatDateTimeVi(detailLead.createdAt)}</div>
                    {detailLead.lastContactAt ? (
                      <div className="text-cyan-600 font-medium">🕐 Liên hệ cuối: {relativeTime(detailLead.lastContactAt)}</div>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* ── Ghi chú nổi bật ── */}
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm">📝</span>
                  <h3 className="text-sm font-bold text-amber-800">Ghi chú</h3>
                </div>
                <p className="text-sm text-amber-900 whitespace-pre-wrap">
                  {detailLead.note || "Chưa có ghi chú. Nhấn \"Sửa\" để thêm."}
                </p>
              </div>

              {/* Tags */}
              {detailLead.tags && detailLead.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {detailLead.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 border border-zinc-200">#{tag}</span>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    openEditLead(detailLead);
                  }}
                >
                  ✏️ Sửa
                </Button>
                {canDeleteLead ? (
                  <Button
                    variant="secondary"
                    className="!text-red-600 !border-red-200 hover:!bg-red-50"
                    onClick={() => openDeleteLead(detailLead)}
                  >
                    🗑️ Xóa
                  </Button>
                ) : null}
              </div>

              {/* ── Lịch sử cuộc gọi ── */}
              {(() => {
                const callEvents = detailEvents.filter(e => e.type === "CALLED");
                const otherEvents = detailEvents.filter(e => e.type !== "CALLED");
                return (
                  <>
                    <div className="rounded-xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-teal-50 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="flex items-center gap-2 text-sm font-bold text-cyan-800">
                          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600 text-xs text-white">📞</span>
                          Lịch sử cuộc gọi ({callEvents.length})
                        </h3>
                        <Button
                          className="!bg-gradient-to-r !from-green-500 !to-emerald-500 !text-white !text-xs !px-3 !py-1.5"
                          disabled={eventSaving}
                          onClick={() => {
                            setEventForm({ type: "CALLED", note: "", meta: "" });
                            addEvent(detailLead.id);
                          }}
                        >
                          📞 Ghi nhận cuộc gọi
                        </Button>
                      </div>
                      {/* Quick call note */}
                      <div className="flex gap-2 mb-3">
                        <Input
                          placeholder="Ghi chú cuộc gọi (nhấn Enter)…"
                          value={eventForm.type === "CALLED" ? eventForm.note : ""}
                          onChange={(e) => setEventForm({ type: "CALLED", note: e.target.value, meta: "" })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !eventSaving && detailLead) {
                              setEventForm(prev => ({ ...prev, type: "CALLED" }));
                              addEvent(detailLead.id);
                            }
                          }}
                          className="!text-xs"
                        />
                      </div>
                      {callEvents.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-cyan-200 bg-white/50 p-3 text-center text-xs text-cyan-600">
                          Chưa có cuộc gọi nào. Bấm &quot;Ghi nhận cuộc gọi&quot; để thêm.
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {callEvents.map((event) => {
                            const payload = event.payload as Record<string, unknown> | null | undefined;
                            const eventNote = payload?.note as string | undefined;
                            return (
                              <div key={event.id} className="flex items-start gap-2 rounded-lg bg-white/70 border border-cyan-100 px-3 py-2">
                                <span className="mt-0.5 text-cyan-500 text-sm">📞</span>
                                <div className="flex-1 min-w-0">
                                  {eventNote ? (
                                    <p className="text-sm text-zinc-700">{eventNote}</p>
                                  ) : (
                                    <p className="text-sm text-zinc-400 italic">Đã gọi (không ghi chú)</p>
                                  )}
                                  <p className="text-[11px] text-zinc-400 mt-0.5">{relativeTime(event.createdAt)} · {formatDateTimeVi(event.createdAt)}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* ── Thêm sự kiện khác ── */}
                    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3">
                      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-blue-800">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 text-xs text-white">+</span>
                        Thêm sự kiện khác
                      </h3>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                        <div className="flex-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
                          <Select value={eventForm.type} onChange={(e) => setEventForm((s) => ({ ...s, type: e.target.value }))}>
                            {EVENT_OPTIONS.map((type) => (
                              <option key={type} value={type}>
                                {STATUS_LABELS[type] || type}
                              </option>
                            ))}
                          </Select>
                          <Input
                            placeholder="Ghi chú sự kiện..."
                            value={eventForm.note}
                            className="col-span-1 sm:col-span-2"
                            onChange={(e) => setEventForm((s) => ({ ...s, note: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !eventSaving && detailLead) {
                                addEvent(detailLead.id);
                              }
                            }}
                          />
                        </div>
                        <Button
                          className="!bg-gradient-to-r !from-blue-600 !to-cyan-600 !text-white shrink-0"
                          disabled={eventSaving}
                          onClick={() => addEvent(detailLead.id)}
                        >
                          {eventSaving ? "Đang lưu..." : "Lưu"}
                        </Button>
                      </div>
                    </div>

                    {/* ── Nhật ký sự kiện khác ── */}
                    {otherEvents.length > 0 ? (
                      <div>
                        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-zinc-900">
                          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-xs text-white">📋</span>
                          Sự kiện khác ({otherEvents.length})
                        </h3>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {otherEvents.map((event) => {
                            const es = statusStyle(event.type);
                            const payload = event.payload as Record<string, unknown> | null | undefined;
                            const eventNote = payload?.note as string | undefined;
                            return (
                              <div key={event.id} className={`overflow-hidden rounded-xl border ${es.border} bg-white shadow-sm`}>
                                <div className={`h-0.5 bg-gradient-to-r ${es.gradient}`} />
                                <div className="p-3">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className={`inline-flex items-center gap-1 rounded-full ${es.bg} ${es.text} px-2 py-0.5 text-xs font-bold`}>
                                      {es.icon} {STATUS_LABELS[event.type] || event.type}
                                    </span>
                                    <span className="text-xs text-zinc-500">{relativeTime(event.createdAt)}</span>
                                  </div>
                                  {eventNote ? (
                                    <p className="mt-1.5 text-sm text-zinc-700 pl-1">💬 {eventNote}</p>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </>
                );
              })()}
            </div>
          ) : null}
        </Modal>

        <Modal open={Boolean(assignLead)} title="Gán telesale phụ trách" onClose={() => setAssignLead(null)}>
          <div className="space-y-3">
            <p className="text-sm text-zinc-700">
              {assignLead ? `Khách hàng: ${assignLead.fullName || assignLead.id}` : ""}
            </p>
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
                Huỷ
              </Button>
              <Button onClick={submitAssignOwner} disabled={assignSaving}>
                {assignSaving ? "Đang lưu..." : "Lưu"}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Edit Lead Modal */}
        <Modal
          open={editOpen}
          title="Sửa khách hàng"
          onClose={() => setEditOpen(false)}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditOpen(false)}>Huỷ</Button>
              <Button onClick={saveEditLead} disabled={editSaving}>
                {editSaving ? "Đang lưu..." : "Lưu thay đổi"}
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Họ và tên</label>
              <Input value={editForm.fullName} onChange={(e) => setEditForm((s) => ({ ...s, fullName: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Số điện thoại</label>
              <Input value={editForm.phone} inputMode="tel" onChange={(e) => setEditForm((s) => ({ ...s, phone: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Tỉnh thành</label>
                <Input value={editForm.province} onChange={(e) => setEditForm((s) => ({ ...s, province: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Hạng bằng</label>
                <Input value={editForm.licenseType} onChange={(e) => setEditForm((s) => ({ ...s, licenseType: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Nguồn</label>
                <Input value={editForm.source} onChange={(e) => setEditForm((s) => ({ ...s, source: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Kênh</label>
                <Input value={editForm.channel} onChange={(e) => setEditForm((s) => ({ ...s, channel: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Ghi chú</label>
              <Input value={editForm.note} onChange={(e) => setEditForm((s) => ({ ...s, note: e.target.value }))} />
            </div>
          </div>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          open={deleteOpen}
          title="Xác nhận xóa khách hàng"
          onClose={() => setDeleteOpen(false)}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Huỷ</Button>
              <Button
                className="!bg-red-600 !text-white hover:!bg-red-700"
                onClick={confirmDeleteLead}
                disabled={deleteSaving}
              >
                {deleteSaving ? "Đang xóa..." : "Xóa"}
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              ⚠️ Bạn chắc chắn muốn xóa khách hàng <strong>{deleteLeadName}</strong>?
              <br />
              Hành động này không thể hoàn tác. Tất cả sự kiện và tin nhắn liên quan sẽ bị xóa.
            </div>
          </div>
        </Modal>
      </div>
    </MobileShell>
  );
}
