"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, fetchMe, getToken } from "@/lib/auth-client";
import { isAdminRole, isTelesalesRole } from "@/lib/admin-auth";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilterCard } from "@/components/ui/filter-card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
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

function statusTone(status: string): "primary" | "accent" | "neutral" {
  if (status === "SIGNED" || status === "RESULT") return "accent";
  if (status === "LOST") return "neutral";
  return "primary";
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
    <div className="space-y-4">
      <PageHeader
        title="Bảng Kanban khách hàng"
        subtitle="Theo dõi pipeline theo trạng thái"
        actions={
          <>
            {canManageOwner ? <Badge text="Admin · Quản trị" tone="accent" /> : null}
            <Button onClick={loadBoard}>
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner /> Đang tải...
                </span>
              ) : (
                "Làm mới"
              )}
            </Button>
          </>
        }
      />

      <div className="sticky top-[68px] z-20 space-y-2 rounded-[16px] border border-[var(--border)] bg-zinc-100/90 p-2 backdrop-blur md:top-[72px]">
        <div className="surface flex flex-wrap items-center gap-2 px-3 py-2">
          <Button variant="secondary" onClick={() => setFilterOpen(true)}>
            Bộ lọc
          </Button>
          {filters.q ? <Badge text={`Từ khóa: ${filters.q}`} tone="primary" /> : null}
          {filters.source ? <Badge text={`Nguồn: ${filters.source}`} tone="accent" /> : null}
          {filters.channel ? <Badge text={`Kênh: ${filters.channel}`} tone="accent" /> : null}
          {filters.licenseType ? <Badge text={`Hạng bằng: ${filters.licenseType}`} tone="primary" /> : null}
          {filters.createdFrom || filters.createdTo ? (
            <Badge text={`Ngày: ${filters.createdFrom || "..."} - ${filters.createdTo || "..."}`} tone="neutral" />
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            <Button variant="secondary" onClick={() => applyFiltersToUrl(filters)}>
              Áp dụng
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setFilters(EMPTY_FILTERS);
                applyFiltersToUrl(EMPTY_FILTERS);
              }}
            >
              Xóa lọc
            </Button>
          </div>
        </div>

        <div className="surface flex gap-2 overflow-x-auto p-2 md:hidden">
          {STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setMobileStatus(status)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${
                mobileStatus === status
                  ? "bg-slate-900 text-white"
                  : "border border-zinc-300 bg-white text-zinc-700"
              }`}
            >
              {STATUS_LABELS[status] || status}
            </button>
          ))}
        </div>
      </div>

      {error ? <Alert type="error" message={error} /> : null}

      {loading ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-600 shadow-sm">Đang tải bảng Kanban...</div>
      ) : (
        <div className="overflow-x-auto pb-1">
          <div className="flex min-w-max gap-3">
            {STATUSES.map((status) => {
              const items = byStatus[status] || [];
              return (
                <section
                  key={status}
                  className={`w-[320px] shrink-0 rounded-2xl border border-zinc-200 bg-zinc-100/70 p-2 ${
                    mobileStatus === status ? "block" : "hidden md:block"
                  }`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDrop(status)}
                >
                  <div className="sticky top-0 z-10 mb-2 flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 shadow-sm">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{STATUS_LABELS[status] || status}</p>
                      <span className="inline-flex min-w-6 items-center justify-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                        {items.length}
                      </span>
                    </div>
                    <Badge text={status} tone={statusTone(status)} />
                  </div>

                  <div className="space-y-2">
                    {items.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-3 py-5 text-center text-xs text-zinc-500">
                        Chưa có khách trong cột này.
                        <br />
                        Thử điều chỉnh bộ lọc để xem thêm dữ liệu.
                      </div>
                    ) : (
                      items.map((lead) => (
                        <article
                          key={lead.id}
                          draggable
                          onDragStart={() => setDraggingLead(lead)}
                          className="rounded-xl border border-zinc-200 bg-white p-3 text-xs shadow-sm transition hover:border-slate-300 hover:shadow"
                        >
                          <div className="mb-1 flex items-start justify-between gap-2">
                            <p className="line-clamp-2 text-sm font-semibold text-slate-900">{lead.fullName || "Chưa có tên"}</p>
                            <div className="flex items-center gap-1">
                              <Badge text={lead.licenseType || "-"} tone="accent" />
                            </div>
                          </div>

                          <p className="font-mono text-sm text-zinc-800">{lead.phone || "-"}</p>

                          <div className="mt-2 grid gap-1 text-zinc-600">
                            <p>
                              <span className="text-zinc-500">Nguồn:</span> {lead.source || "-"} · {lead.channel || "-"}
                            </p>
                            <p>
                              <span className="text-zinc-500">Phụ trách:</span> {lead.owner?.name || lead.owner?.email || "-"}
                            </p>
                            <p>
                              <span className="text-zinc-500">Liên hệ gần nhất:</span>{" "}
                              {lead.lastContactAt ? formatDateTimeVi(lead.lastContactAt) : "-"}
                            </p>
                          </div>

                          <div className="mt-3 space-y-2">
                            <Select
                              value={lead.status}
                              onChange={(e) => changeStatus(lead.id, lead.status, e.target.value)}
                              disabled={updatingId === lead.id}
                            >
                              {STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {STATUS_LABELS[s] || s}
                                </option>
                              ))}
                            </Select>

                            <div className="flex items-center justify-between gap-2">
                              <Link
                                href={`/leads/${lead.id}`}
                                className="inline-flex items-center rounded-xl border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                              >
                                Chi tiết
                              </Link>

                              <details className="relative">
                                <summary className="list-none cursor-pointer rounded-xl border border-zinc-300 px-2 py-1 text-sm text-zinc-700 hover:bg-zinc-100">
                                  ...
                                </summary>
                                <div className="absolute right-0 z-20 mt-1 w-40 rounded-xl border border-zinc-200 bg-white p-1 shadow-lg">
                                  {canManageOwner ? (
                                    <button
                                      type="button"
                                      className="block w-full rounded-lg px-2 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-100"
                                      onClick={() => {
                                        setAssignLead(lead);
                                        setAssignOwnerId(lead.ownerId || "");
                                      }}
                                    >
                                      Gán telesale
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    className="block w-full rounded-lg px-2 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-100"
                                    onClick={() => {
                                      setEventLeadId(lead.id);
                                      setEventOpen(true);
                                    }}
                                  >
                                    Thêm sự kiện
                                  </button>
                                  <Link
                                    href={`/leads/${lead.id}`}
                                    className="block w-full rounded-lg px-2 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-100"
                                  >
                                    Mở chi tiết
                                  </Link>
                                </div>
                              </details>
                            </div>

                            <p className="text-[11px] text-zinc-500">Tạo: {formatDateTimeVi(lead.createdAt)}</p>
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

      <Modal
        open={filterOpen}
        title="Bộ lọc Kanban"
        description="Thiết lập điều kiện lọc để giảm nhiễu khi theo dõi pipeline"
        onClose={() => setFilterOpen(false)}
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

          <div className="sticky bottom-0 flex justify-end gap-2 border-t border-zinc-200 bg-white pt-3">
            <Button
              variant="secondary"
              onClick={() => {
                setFilters(EMPTY_FILTERS);
                setFilterOpen(false);
                applyFiltersToUrl(EMPTY_FILTERS);
              }}
            >
              Xóa lọc
            </Button>
            <Button
              onClick={() => {
                setFilterOpen(false);
                applyFiltersToUrl(filters);
              }}
            >
              Áp dụng
            </Button>
          </div>
        </div>
      </Modal>

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
  );
}
