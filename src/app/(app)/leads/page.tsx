"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, fetchMe, getToken } from "@/lib/auth-client";
import { isAdminRole, isTelesalesRole } from "@/lib/admin-auth";
import { Alert } from "@/components/ui/alert";
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
import { PageHeader } from "@/components/ui/page-header";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { DataCard } from "@/components/mobile/DataCard";
import { EmptyState } from "@/components/mobile/EmptyState";
import { MobileFiltersSheet } from "@/components/mobile/MobileFiltersSheet";
import { MobileHeader } from "@/components/app/mobile-header";
import { MobileToolbar } from "@/components/app/mobile-toolbar";
import { formatDateTimeVi } from "@/lib/date-utils";

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
  createdAt: string;
  updatedAt: string;
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
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState("desc");
  const [filtersDraft, setFiltersDraft] = useState<Filters>(INITIAL_FILTERS);
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [canManageOwner, setCanManageOwner] = useState(false);
  const [isTelesales, setIsTelesales] = useState(false);
  const [owners, setOwners] = useState<UserOption[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
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
      const data = await fetchJson<LeadListResponse>(`/api/leads?${query}`, { token });
      setItems(data.items);
      setTotal(data.total);
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
      })
      .catch(() => {
        setCanManageOwner(false);
        setIsTelesales(false);
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

  async function createLead() {
    const token = getToken();
    if (!token) return;
    setCreateSaving(true);
    setError("");
    try {
      await fetchJson("/api/leads", {
        method: "POST",
        token,
        body: {
          fullName: createForm.fullName || null,
          phone: createForm.phone || null,
          source: createForm.source || null,
          channel: createForm.channel || null,
          licenseType: createForm.licenseType || null,
        },
      });
      setCreateOpen(false);
      setCreateForm({ fullName: "", phone: "", source: "manual", channel: "manual", licenseType: "" });
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
    setStatusSaving(true);
    try {
      await fetchJson(`/api/leads/${pendingStatus.id}`, {
        method: "PATCH",
        token,
        body: { status: pendingStatus.status },
      });
      const updatedId = pendingStatus.id;
      setPendingStatus(null);
      await loadLeads();
      if (detailLead?.id === updatedId) openDetail(updatedId);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(formatError(err));
    } finally {
      setStatusSaving(false);
    }
  }

  async function addEvent() {
    if (!eventLeadId) return;
    const token = getToken();
    if (!token) return;
    setEventSaving(true);
    try {
      const meta = eventForm.meta.trim() ? JSON.parse(eventForm.meta) : undefined;
      await fetchJson(`/api/leads/${eventLeadId}/events`, {
        method: "POST",
        token,
        body: { type: eventForm.type, note: eventForm.note || undefined, meta },
      });
      const currentLeadId = eventLeadId;
      setEventForm({ type: "CALLED", note: "", meta: "" });
      setEventOpen(false);
      setEventLeadId("");
      await loadLeads();
      if (detailLead?.id === currentLeadId) openDetail(currentLeadId);
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

  const activeFilterCount = Object.values(filtersDraft).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <MobileHeader
        title="Khách hàng"
        subtitle="Danh sách và chuyển đổi trạng thái"
        rightActions={<Button onClick={() => setCreateOpen(true)}>Tạo</Button>}
      />

      <div className="hidden md:block">
        <PageHeader
          title="Khách hàng"
          subtitle="Quản lý dữ liệu lead và theo dõi trạng thái chuyển đổi"
          actions={<Button onClick={() => setCreateOpen(true)}>Tạo mới</Button>}
        />
      </div>

      {error ? <Alert type="error" message={error} /> : null}

      <div className="sticky top-[116px] z-20 rounded-2xl border border-zinc-200 bg-zinc-100/90 p-2 backdrop-blur md:hidden">
        <MobileToolbar
          value={filtersDraft.q}
          onChange={(value) => setFiltersDraft((s) => ({ ...s, q: value }))}
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
            <>
              <Button
                onClick={() => {
                  setPage(1);
                  setFilters(filtersDraft);
                }}
              >
                Áp dụng bộ lọc
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setFiltersDraft(INITIAL_FILTERS);
                  setFilters(INITIAL_FILTERS);
                  setPage(1);
                }}
              >
                Làm mới
              </Button>
            </>
          }
        >
          <div className="grid gap-2 md:grid-cols-4">
            <Input
              placeholder="Tìm kiếm tên/SĐT"
              value={filtersDraft.q}
              onChange={(e) => setFiltersDraft((s) => ({ ...s, q: e.target.value }))}
            />
            <Select
              value={filtersDraft.status}
              onChange={(e) => setFiltersDraft((s) => ({ ...s, status: e.target.value }))}
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
              value={filtersDraft.source}
              onChange={(e) => setFiltersDraft((s) => ({ ...s, source: e.target.value }))}
            />
            <Input
              placeholder="Kênh"
              value={filtersDraft.channel}
              onChange={(e) => setFiltersDraft((s) => ({ ...s, channel: e.target.value }))}
            />
            <Input
              placeholder="Hạng bằng"
              value={filtersDraft.licenseType}
              onChange={(e) => setFiltersDraft((s) => ({ ...s, licenseType: e.target.value }))}
            />
            {canManageOwner ? (
              <Select
                value={filtersDraft.ownerId}
                onChange={(e) => setFiltersDraft((s) => ({ ...s, ownerId: e.target.value }))}
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
                value={filtersDraft.ownerId}
                onChange={(e) => setFiltersDraft((s) => ({ ...s, ownerId: e.target.value }))}
              />
            ) : null}
            <Input
              type="date"
              value={filtersDraft.createdFrom}
              onChange={(e) => setFiltersDraft((s) => ({ ...s, createdFrom: e.target.value }))}
            />
            <Input
              type="date"
              value={filtersDraft.createdTo}
              onChange={(e) => setFiltersDraft((s) => ({ ...s, createdTo: e.target.value }))}
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
          <div className="surface rounded-2xl px-3 py-6 text-center text-sm text-zinc-600">Đang tải dữ liệu khách hàng...</div>
        ) : items.length === 0 ? (
          <EmptyState title="Không có khách hàng" description="Thử nới bộ lọc hoặc tạo khách hàng mới." />
        ) : (
          items.map((lead) => (
            <DataCard
              key={lead.id}
              title={lead.fullName || "Chưa có tên"}
              subtitle={lead.phone || "Chưa có SĐT"}
              badge={<Badge text={STATUS_LABELS[lead.status] || lead.status} tone="primary" />}
              footer={
                <>
                  <Button variant="secondary" onClick={() => openDetail(lead.id)}>
                    Chi tiết
                  </Button>
                  <Button variant="ghost" onClick={() => setMobileActionLead(lead)}>
                    ...
                  </Button>
                </>
              }
            >
              <div className="space-y-1 text-xs">
                <p>
                  <span className="text-zinc-500">Nguồn:</span> {lead.source || "-"} · {lead.channel || "-"}
                </p>
                <p>
                  <span className="text-zinc-500">Phụ trách:</span> {lead.owner?.name || lead.owner?.email || "-"}
                </p>
                <p>
                  <span className="text-zinc-500">Tạo lúc:</span> {formatDateTimeVi(lead.createdAt)}
                </p>
              </div>
            </DataCard>
          ))
        )}
      </div>

      <div className="hidden md:block">
        <DataTable
          loading={loading}
          isEmpty={!loading && items.length === 0}
          emptyText="Không có dữ liệu khách hàng."
        >
          <Table headers={["Khách hàng", "SĐT", "Trạng thái", "Người phụ trách", "Nguồn/Kênh", "Ngày tạo", "Hành động"]}>
            {items.map((lead) => (
              <tr key={lead.id}>
                <td className="px-3 py-2">
                  <div className="font-medium text-zinc-900">{lead.fullName || "Chưa có tên"}</div>
                  <div className="text-xs text-zinc-500">{lead.id}</div>
                </td>
                <td className="px-3 py-2">{lead.phone || "-"}</td>
                <td className="px-3 py-2">
                  <Badge text={STATUS_LABELS[lead.status] || lead.status} />
                </td>
                <td className="px-3 py-2 text-xs text-zinc-600">{lead.owner?.name || lead.owner?.email || "-"}</td>
                <td className="px-3 py-2">
                  <div>{lead.source || "-"}</div>
                  <div className="text-xs text-zinc-500">{lead.channel || "-"}</div>
                </td>
                <td className="px-3 py-2 text-xs text-zinc-600">{formatDateTimeVi(lead.createdAt)}</td>
                <td className="space-y-2 px-3 py-2">
                  <Button variant="secondary" className="w-full" onClick={() => openDetail(lead.id)}>
                    Mở
                  </Button>
                  {canManageOwner ? (
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => {
                        setAssignLead(lead);
                        setAssignOwnerId(lead.ownerId || "");
                      }}
                    >
                      Gán telesale
                    </Button>
                  ) : null}
                  <Select value={lead.status} onChange={(e) => setPendingStatus({ id: lead.id, status: e.target.value })}>
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {STATUS_LABELS[status] || status}
                      </option>
                    ))}
                  </Select>
                </td>
              </tr>
            ))}
          </Table>
        </DataTable>
      </div>

      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />

      <MobileFiltersSheet
        open={mobileFilterOpen}
        onOpenChange={setMobileFilterOpen}
        title="Bộ lọc khách hàng"
        onApply={() => {
          setPage(1);
          setFilters(filtersDraft);
        }}
        onReset={() => {
          setFiltersDraft(INITIAL_FILTERS);
          setFilters(INITIAL_FILTERS);
          setPage(1);
        }}
      >
        <div className="space-y-3">
          <Input
            placeholder="Tìm kiếm tên/SĐT"
            value={filtersDraft.q}
            onChange={(e) => setFiltersDraft((s) => ({ ...s, q: e.target.value }))}
          />
          <Select
            value={filtersDraft.status}
            onChange={(e) => setFiltersDraft((s) => ({ ...s, status: e.target.value }))}
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
            value={filtersDraft.source}
            onChange={(e) => setFiltersDraft((s) => ({ ...s, source: e.target.value }))}
          />
          <Input
            placeholder="Kênh"
            value={filtersDraft.channel}
            onChange={(e) => setFiltersDraft((s) => ({ ...s, channel: e.target.value }))}
          />
          <Input
            placeholder="Hạng bằng"
            value={filtersDraft.licenseType}
            onChange={(e) => setFiltersDraft((s) => ({ ...s, licenseType: e.target.value }))}
          />
          {canManageOwner ? (
            <Select
              value={filtersDraft.ownerId}
              onChange={(e) => setFiltersDraft((s) => ({ ...s, ownerId: e.target.value }))}
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
              value={filtersDraft.ownerId}
              onChange={(e) => setFiltersDraft((s) => ({ ...s, ownerId: e.target.value }))}
            />
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              value={filtersDraft.createdFrom}
              onChange={(e) => setFiltersDraft((s) => ({ ...s, createdFrom: e.target.value }))}
            />
            <Input
              type="date"
              value={filtersDraft.createdTo}
              onChange={(e) => setFiltersDraft((s) => ({ ...s, createdTo: e.target.value }))}
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
            <p className="text-xs text-zinc-500">{mobileActionLead.fullName || mobileActionLead.id}</p>
          ) : null}
          {canManageOwner ? (
            <Button
              variant="secondary"
              className="w-full justify-start"
              onClick={() => {
                if (!mobileActionLead) return;
                setAssignLead(mobileActionLead);
                setAssignOwnerId(mobileActionLead.ownerId || "");
                setMobileActionLead(null);
              }}
            >
              Gán telesale
            </Button>
          ) : null}
          <Button
            variant="secondary"
            className="w-full justify-start"
            onClick={() => {
              if (!mobileActionLead) return;
              setEventLeadId(mobileActionLead.id);
              setEventOpen(true);
              setMobileActionLead(null);
            }}
          >
            Thêm sự kiện
          </Button>
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

      <Modal open={createOpen} title="Tạo khách hàng" onClose={() => setCreateOpen(false)}>
        <div className="space-y-3">
          <Input placeholder="Họ và tên" value={createForm.fullName} onChange={(e) => setCreateForm((s) => ({ ...s, fullName: e.target.value }))} />
          <Input placeholder="SĐT (không bắt buộc)" value={createForm.phone} onChange={(e) => setCreateForm((s) => ({ ...s, phone: e.target.value }))} />
          <Input placeholder="Nguồn" value={createForm.source} onChange={(e) => setCreateForm((s) => ({ ...s, source: e.target.value }))} />
          <Input placeholder="Kênh" value={createForm.channel} onChange={(e) => setCreateForm((s) => ({ ...s, channel: e.target.value }))} />
          <Input placeholder="Hạng bằng" value={createForm.licenseType} onChange={(e) => setCreateForm((s) => ({ ...s, licenseType: e.target.value }))} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Huỷ
            </Button>
            <Button onClick={createLead} disabled={createSaving}>
              {createSaving ? "Đang tạo..." : "Tạo mới"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(pendingStatus)} title="Xác nhận cập nhật trạng thái" onClose={() => setPendingStatus(null)}>
        <p className="text-sm text-zinc-700">
          {pendingStatus ? `Bạn chắc chắn muốn cập nhật trạng thái thành ${STATUS_LABELS[pendingStatus.status] || pendingStatus.status}?` : ""}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setPendingStatus(null)}>
            Huỷ
          </Button>
          <Button onClick={confirmStatusChange} disabled={statusSaving}>
            {statusSaving ? "Đang cập nhật..." : "Xác nhận"}
          </Button>
        </div>
      </Modal>

      <Modal open={eventOpen} title="Thêm sự kiện" onClose={() => setEventOpen(false)}>
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
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEventOpen(false)}>
              Hủy
            </Button>
            <Button onClick={addEvent} disabled={eventSaving}>
              {eventSaving ? "Đang lưu..." : "Lưu sự kiện"}
            </Button>
          </div>
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
            <div className="grid gap-2 rounded-lg bg-zinc-50 p-3 text-sm md:grid-cols-2">
              <div>
                <span className="text-zinc-500">Khách hàng:</span> {detailLead.fullName || "-"}
              </div>
              <div>
                <span className="text-zinc-500">SĐT:</span> {detailLead.phone || "-"}
              </div>
              <div>
                <span className="text-zinc-500">Trạng thái:</span> {STATUS_LABELS[detailLead.status] || detailLead.status}
              </div>
              <div>
                <span className="text-zinc-500">Nguồn:</span> {detailLead.source || "-"}
              </div>
              <div>
                <span className="text-zinc-500">Kênh:</span> {detailLead.channel || "-"}
              </div>
              <div>
                <span className="text-zinc-500">Hạng bằng:</span> {detailLead.licenseType || "-"}
              </div>
              <div>
                <span className="text-zinc-500">Người phụ trách:</span> {detailLead.owner?.name || detailLead.owner?.email || "-"}
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setEventLeadId(detailLead.id);
                  setEventOpen(true);
                }}
              >
                Thêm sự kiện
              </Button>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-zinc-900">Nhật ký sự kiện</h3>
              {detailEvents.length === 0 ? (
                <div className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-500">Chưa có sự kiện.</div>
              ) : (
                <div className="space-y-2">
                  {detailEvents.map((event) => (
                    <div key={event.id} className="rounded-lg border border-zinc-200 p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <Badge text={STATUS_LABELS[event.type] || event.type} />
                        <span className="text-xs text-zinc-500">{formatDateTimeVi(event.createdAt)}</span>
                      </div>
                      {event.payload ? (
                        <pre className="mt-2 overflow-auto rounded bg-zinc-50 p-2 text-xs text-zinc-700">
                          {JSON.stringify(event.payload, null, 2)}
                        </pre>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
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
    </div>
  );
}
