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
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

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

export default function LeadsBoardPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
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
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-900">Leads Board</h1>
        <Button variant="secondary" onClick={loadBoard}>
          Refresh
        </Button>
      </div>

      {error ? <Alert type="error" message={error} /> : null}

      <div className="grid gap-2 rounded-xl bg-white p-4 shadow-sm md:grid-cols-4">
        <Input value={filters.q} placeholder="Search q" onChange={(e) => setFilters((s) => ({ ...s, q: e.target.value }))} />
        <Input value={filters.source} placeholder="Source" onChange={(e) => setFilters((s) => ({ ...s, source: e.target.value }))} />
        <Input value={filters.channel} placeholder="Channel" onChange={(e) => setFilters((s) => ({ ...s, channel: e.target.value }))} />
        <Input
          value={filters.licenseType}
          placeholder="License type"
          onChange={(e) => setFilters((s) => ({ ...s, licenseType: e.target.value }))}
        />
        {canManageOwner ? (
          <Select value={filters.ownerId} onChange={(e) => setFilters((s) => ({ ...s, ownerId: e.target.value }))}>
            <option value="">All owners</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name || owner.email}
              </option>
            ))}
          </Select>
        ) : !isTelesales ? (
          <Input value={filters.ownerId} placeholder="Owner ID" onChange={(e) => setFilters((s) => ({ ...s, ownerId: e.target.value }))} />
        ) : null}
        <Input type="date" value={filters.createdFrom} onChange={(e) => setFilters((s) => ({ ...s, createdFrom: e.target.value }))} />
        <Input type="date" value={filters.createdTo} onChange={(e) => setFilters((s) => ({ ...s, createdTo: e.target.value }))} />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => applyFiltersToUrl(filters)}>Apply</Button>
          <Button
            variant="secondary"
            onClick={() => {
              setFilters(EMPTY_FILTERS);
              applyFiltersToUrl(EMPTY_FILTERS);
            }}
          >
            Clear
          </Button>
        </div>
        <div className="md:col-span-4 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              const today = dateYmdLocal(new Date());
              const next = { ...filters, createdFrom: today, createdTo: today };
              setFilters(next);
              applyFiltersToUrl(next);
            }}
          >
            Today
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              const now = new Date();
              const start = new Date(now);
              start.setDate(now.getDate() - 6);
              const next = { ...filters, createdFrom: dateYmdLocal(start), createdTo: dateYmdLocal(now) };
              setFilters(next);
              applyFiltersToUrl(next);
            }}
          >
            This week
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl bg-white p-6 text-zinc-600">Loading board...</div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-3 xl:grid-cols-5">
          {STATUSES.map((status) => (
            <div
              key={status}
              className="rounded-xl border border-zinc-200 bg-white p-3"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(status)}
            >
              <div className="mb-3 flex items-center justify-between">
                <Badge text={status} />
                <span className="text-xs text-zinc-500">{(byStatus[status] || []).length}</span>
              </div>
              <div className="space-y-2">
                {(byStatus[status] || []).length === 0 ? (
                  <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500">Empty</div>
                ) : (
                  byStatus[status].map((lead) => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={() => setDraggingLead(lead)}
                      className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs"
                    >
                      <div className="font-medium text-zinc-900">{lead.fullName || "Unnamed"}</div>
                      <div className="text-zinc-600">{lead.phone || "-"}</div>
                      <div className="mt-1 text-zinc-500">
                        {lead.source || "-"} / {lead.channel || "-"}
                      </div>
                      <div className="text-zinc-500">License: {lead.licenseType || "-"}</div>
                      <div className="text-zinc-500">Owner: {lead.owner?.name || lead.owner?.email || "-"}</div>
                      <div className="text-zinc-500">
                        Last contact: {lead.lastContactAt ? new Date(lead.lastContactAt).toLocaleString() : "-"}
                      </div>
                      <div className="text-zinc-500">Created: {new Date(lead.createdAt).toLocaleString()}</div>
                      <div className="mt-2 space-y-1">
                        <Select
                          value={lead.status}
                          onChange={(e) => changeStatus(lead.id, lead.status, e.target.value)}
                          disabled={updatingId === lead.id}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </Select>
                        <div className="flex gap-1">
                          {canManageOwner ? (
                            <Button
                              variant="secondary"
                              className="flex-1"
                              onClick={() => {
                                setAssignLead(lead);
                                setAssignOwnerId(lead.ownerId || "");
                              }}
                            >
                              Gán telesale
                            </Button>
                          ) : null}
                          <Button
                            variant="secondary"
                            className="flex-1"
                            onClick={() => {
                              setEventLeadId(lead.id);
                              setEventOpen(true);
                            }}
                          >
                            Add Event
                          </Button>
                          <Link
                            href={`/leads/${lead.id}`}
                            className="flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-2 text-center text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                          >
                            Detail
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={eventOpen} title="Add Lead Event" onClose={() => setEventOpen(false)}>
        <div className="space-y-3">
          <Select value={eventType} onChange={(e) => setEventType(e.target.value)}>
            {EVENT_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <Input placeholder="Note" value={eventNote} onChange={(e) => setEventNote(e.target.value)} />
          <Input placeholder="Meta JSON (optional)" value={eventMeta} onChange={(e) => setEventMeta(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEventOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitEvent} disabled={eventSaving}>
              {eventSaving ? (
                <span className="flex items-center gap-2">
                  <Spinner /> Saving...
                </span>
              ) : (
                "Save Event"
              )}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(assignLead)} title="Gán telesale phụ trách" onClose={() => setAssignLead(null)}>
        <div className="space-y-3">
          <p className="text-sm text-zinc-700">
            {assignLead ? `Lead: ${assignLead.fullName || assignLead.id}` : ""}
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
