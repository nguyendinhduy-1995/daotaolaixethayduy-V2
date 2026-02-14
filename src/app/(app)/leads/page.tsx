"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

  const [eventSaving, setEventSaving] = useState(false);
  const [eventForm, setEventForm] = useState({ type: "CALLED", note: "", meta: "" });

  const [pendingStatus, setPendingStatus] = useState<{ id: string; status: string } | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [assignLead, setAssignLead] = useState<Lead | null>(null);
  const [assignOwnerId, setAssignOwnerId] = useState("");
  const [assignSaving, setAssignSaving] = useState(false);

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
      setPendingStatus(null);
      await loadLeads();
      if (detailLead?.id === pendingStatus.id) openDetail(pendingStatus.id);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(formatError(err));
    } finally {
      setStatusSaving(false);
    }
  }

  async function addEvent() {
    if (!detailLead) return;
    const token = getToken();
    if (!token) return;
    setEventSaving(true);
    try {
      const meta = eventForm.meta.trim() ? JSON.parse(eventForm.meta) : undefined;
      await fetchJson(`/api/leads/${detailLead.id}/events`, {
        method: "POST",
        token,
        body: { type: eventForm.type, note: eventForm.note || undefined, meta },
      });
      setEventForm({ type: "CALLED", note: "", meta: "" });
      await openDetail(detailLead.id);
      await loadLeads();
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
      setAssignLead(null);
      setAssignOwnerId("");
      await loadLeads();
      if (detailLead?.id === assignLead.id) openDetail(assignLead.id);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(formatError(err));
    } finally {
      setAssignSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-900">Leads</h1>
        <Button onClick={() => setCreateOpen(true)}>Create Lead</Button>
      </div>

      {error ? <Alert type="error" message={error} /> : null}

      <div className="grid gap-2 rounded-xl bg-white p-4 shadow-sm md:grid-cols-4">
        <Input
          placeholder="Search name/phone"
          value={filtersDraft.q}
          onChange={(e) => setFiltersDraft((s) => ({ ...s, q: e.target.value }))}
        />
        <Select
          value={filtersDraft.status}
          onChange={(e) => setFiltersDraft((s) => ({ ...s, status: e.target.value }))}
        >
          <option value="">All status</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </Select>
        <Input
          placeholder="Source"
          value={filtersDraft.source}
          onChange={(e) => setFiltersDraft((s) => ({ ...s, source: e.target.value }))}
        />
        <Input
          placeholder="Channel"
          value={filtersDraft.channel}
          onChange={(e) => setFiltersDraft((s) => ({ ...s, channel: e.target.value }))}
        />
        <Input
          placeholder="License type"
          value={filtersDraft.licenseType}
          onChange={(e) => setFiltersDraft((s) => ({ ...s, licenseType: e.target.value }))}
        />
        {canManageOwner ? (
          <Select
            value={filtersDraft.ownerId}
            onChange={(e) => setFiltersDraft((s) => ({ ...s, ownerId: e.target.value }))}
          >
            <option value="">All owners</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name || owner.email}
              </option>
            ))}
          </Select>
        ) : !isTelesales ? (
          <Input
            placeholder="Owner ID"
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
        <div className="md:col-span-4 flex flex-wrap items-center gap-2">
          <Select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="createdAt">Sort: createdAt</option>
            <option value="updatedAt">Sort: updatedAt</option>
            <option value="lastContactAt">Sort: lastContactAt</option>
          </Select>
          <Select value={order} onChange={(e) => setOrder(e.target.value)}>
            <option value="desc">Order: desc</option>
            <option value="asc">Order: asc</option>
          </Select>
          <Select
            value={String(pageSize)}
            onChange={(e) => {
              setPage(1);
              setPageSize(Number(e.target.value));
            }}
          >
            <option value="20">20 / page</option>
            <option value="50">50 / page</option>
            <option value="100">100 / page</option>
          </Select>
          <Button
            onClick={() => {
              setPage(1);
              setFilters(filtersDraft);
            }}
          >
            Apply Filters
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setFiltersDraft(INITIAL_FILTERS);
              setFilters(INITIAL_FILTERS);
              setPage(1);
            }}
          >
            Reset
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl bg-white p-6 text-zinc-500">Loading leads...</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl bg-white p-6 text-zinc-500">No leads found.</div>
      ) : (
        <Table headers={["Name", "Phone", "Status", "Owner", "Source/Channel", "Created", "Actions"]}>
          {items.map((lead) => (
            <tr key={lead.id} className="border-t border-zinc-100">
              <td className="px-3 py-2">
                <div className="font-medium text-zinc-900">{lead.fullName || "Unnamed"}</div>
                <div className="text-xs text-zinc-500">{lead.id}</div>
              </td>
              <td className="px-3 py-2">{lead.phone || "-"}</td>
              <td className="px-3 py-2">
                <Badge text={lead.status} />
              </td>
              <td className="px-3 py-2 text-xs text-zinc-600">{lead.owner?.name || lead.owner?.email || "-"}</td>
              <td className="px-3 py-2">
                <div>{lead.source || "-"}</div>
                <div className="text-xs text-zinc-500">{lead.channel || "-"}</div>
              </td>
              <td className="px-3 py-2 text-xs text-zinc-600">{new Date(lead.createdAt).toLocaleString()}</td>
              <td className="space-y-2 px-3 py-2">
                <Button variant="secondary" className="w-full" onClick={() => openDetail(lead.id)}>
                  View
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
                    Assign
                  </Button>
                ) : null}
                <Select value={lead.status} onChange={(e) => setPendingStatus({ id: lead.id, status: e.target.value })}>
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </Select>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />

      <Modal open={createOpen} title="Create Lead" onClose={() => setCreateOpen(false)}>
        <div className="space-y-3">
          <Input placeholder="Full name" value={createForm.fullName} onChange={(e) => setCreateForm((s) => ({ ...s, fullName: e.target.value }))} />
          <Input placeholder="Phone (optional)" value={createForm.phone} onChange={(e) => setCreateForm((s) => ({ ...s, phone: e.target.value }))} />
          <Input placeholder="Source" value={createForm.source} onChange={(e) => setCreateForm((s) => ({ ...s, source: e.target.value }))} />
          <Input placeholder="Channel" value={createForm.channel} onChange={(e) => setCreateForm((s) => ({ ...s, channel: e.target.value }))} />
          <Input placeholder="License type" value={createForm.licenseType} onChange={(e) => setCreateForm((s) => ({ ...s, licenseType: e.target.value }))} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createLead} disabled={createSaving}>
              {createSaving ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(pendingStatus)} title="Confirm Status Change" onClose={() => setPendingStatus(null)}>
        <p className="text-sm text-zinc-700">
          {pendingStatus ? `Change lead status to ${pendingStatus.status}?` : ""}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setPendingStatus(null)}>
            Cancel
          </Button>
          <Button onClick={confirmStatusChange} disabled={statusSaving}>
            {statusSaving ? "Updating..." : "Confirm"}
          </Button>
        </div>
      </Modal>

      <Modal open={detailOpen} title="Lead Detail" onClose={() => setDetailOpen(false)}>
        {detailLoading ? (
          <div className="flex items-center gap-2 text-zinc-600">
            <Spinner /> Loading detail...
          </div>
        ) : detailError ? (
          <Alert type="error" message={detailError} />
        ) : detailLead ? (
          <div className="space-y-4">
            <div className="grid gap-2 rounded-lg bg-zinc-50 p-3 text-sm md:grid-cols-2">
              <div>
                <span className="text-zinc-500">Name:</span> {detailLead.fullName || "-"}
              </div>
              <div>
                <span className="text-zinc-500">Phone:</span> {detailLead.phone || "-"}
              </div>
              <div>
                <span className="text-zinc-500">Status:</span> {detailLead.status}
              </div>
              <div>
                <span className="text-zinc-500">Source:</span> {detailLead.source || "-"}
              </div>
              <div>
                <span className="text-zinc-500">Channel:</span> {detailLead.channel || "-"}
              </div>
              <div>
                <span className="text-zinc-500">License:</span> {detailLead.licenseType || "-"}
              </div>
              <div>
                <span className="text-zinc-500">Owner:</span> {detailLead.owner?.name || detailLead.owner?.email || "-"}
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200 p-3">
              <h3 className="mb-2 text-sm font-semibold text-zinc-900">Add Event</h3>
              <div className="grid gap-2 md:grid-cols-3">
                <Select value={eventForm.type} onChange={(e) => setEventForm((s) => ({ ...s, type: e.target.value }))}>
                  {EVENT_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
                <Input placeholder="Note" value={eventForm.note} onChange={(e) => setEventForm((s) => ({ ...s, note: e.target.value }))} />
                <Input placeholder="Meta JSON (optional)" value={eventForm.meta} onChange={(e) => setEventForm((s) => ({ ...s, meta: e.target.value }))} />
              </div>
              <div className="mt-2 flex justify-end">
                <Button onClick={addEvent} disabled={eventSaving}>
                  {eventSaving ? "Saving..." : "Add Event"}
                </Button>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-zinc-900">Recent Events</h3>
              {detailEvents.length === 0 ? (
                <div className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-500">No events yet.</div>
              ) : (
                <div className="space-y-2">
                  {detailEvents.map((event) => (
                    <div key={event.id} className="rounded-lg border border-zinc-200 p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <Badge text={event.type} />
                        <span className="text-xs text-zinc-500">{new Date(event.createdAt).toLocaleString()}</span>
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
