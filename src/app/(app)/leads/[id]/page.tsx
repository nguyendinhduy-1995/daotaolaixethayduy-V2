"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, fetchMe, getToken } from "@/lib/auth-client";
import { isAdminRole } from "@/lib/admin-auth";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrencyVnd, formatDateTimeVi } from "@/lib/date-utils";

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
  lastContactAt: string | null;
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

type LeadEvent = {
  id: string;
  leadId: string;
  type: string;
  note?: string | null;
  payload?: unknown;
  createdAt: string;
  createdById?: string | null;
};
type ReceiptItem = {
  id: string;
  studentId: string;
  amount: number;
  method: string;
  note: string | null;
  receivedAt: string;
};
type StudentItem = {
  id: string;
  leadId: string;
};
type AutomationLog = {
  id: string;
  leadId: string | null;
  studentId: string | null;
  milestone: string | null;
  status: string;
  sentAt: string;
  payload?: unknown;
};
type TimelineSource = "event" | "receipt" | "automation";
type TimelineFilter = "all" | TimelineSource;
type TimelineItem = {
  id: string;
  source: TimelineSource;
  time: string;
  title: string;
  summary: string;
  badgeMain: string;
  badgeSub?: string;
  raw: unknown;
};
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

type TabType = "overview" | "events" | "timeline" | "activity";

function mapReceiptMethodLabel(value: string) {
  if (value === "cash") return "Tiền mặt";
  if (value === "bank_transfer" || value === "bank") return "Chuyển khoản";
  if (value === "card") return "Thẻ";
  return "Momo/Khác";
}

function getRuntimeStatus(payload: unknown, fallback: string) {
  if (
    payload &&
    typeof payload === "object" &&
    "runtimeStatus" in payload &&
    typeof (payload as { runtimeStatus?: unknown }).runtimeStatus === "string"
  ) {
    return (payload as { runtimeStatus: string }).runtimeStatus;
  }
  return fallback === "failed" ? "failed" : "success";
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<TabType>("overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lead, setLead] = useState<Lead | null>(null);

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    source: "",
    channel: "",
    licenseType: "",
    ownerId: "",
    note: "",
    status: "NEW",
  });

  const [events, setEvents] = useState<LeadEvent[]>([]);
  const [eventPage, setEventPage] = useState(1);
  const [eventPageSize] = useState(20);
  const [eventTotal, setEventTotal] = useState(0);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [canManageOwner, setCanManageOwner] = useState(false);
  const [owners, setOwners] = useState<UserOption[]>([]);
  const [ownerSaving, setOwnerSaving] = useState(false);

  const [eventType, setEventType] = useState("CALLED");
  const [eventNote, setEventNote] = useState("");
  const [eventMeta, setEventMeta] = useState("");
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>("all");
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [timelineError, setTimelineError] = useState("");
  const [timelineDetail, setTimelineDetail] = useState<TimelineItem | null>(null);

  const milestones = useMemo(() => {
    const map: Record<string, LeadEvent | null> = {};
    for (const type of STATUS_OPTIONS) {
      map[type] = events.find((event) => event.type === type) ?? null;
    }
    return map;
  }, [events]);

  const ownerMap = useMemo(() => {
    return Object.fromEntries(
      owners.map((owner) => [owner.id, owner.name || owner.email])
    ) as Record<string, string>;
  }, [owners]);

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

  const loadLead = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson<{ lead: Lead }>(`/api/leads/${id}`, { token });
      setLead(data.lead);
      setForm({
        fullName: data.lead.fullName || "",
        phone: data.lead.phone || "",
        source: data.lead.source || "",
        channel: data.lead.channel || "",
        licenseType: data.lead.licenseType || "",
        ownerId: data.lead.ownerId || "",
        note: data.lead.note || "",
        status: data.lead.status,
      });
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`${err.code}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [handleAuthError, id]);

  const loadEvents = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setEventsLoading(true);
    setError("");
    try {
      const data = await fetchJson<{ items: LeadEvent[]; page: number; pageSize: number; total: number }>(
        `/api/leads/${id}/events?page=${eventPage}&pageSize=${eventPageSize}&sort=createdAt&order=desc`,
        { token }
      );
      setEvents(data.items);
      setEventTotal(data.total);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`${err.code}: ${err.message}`);
    } finally {
      setEventsLoading(false);
    }
  }, [eventPage, eventPageSize, handleAuthError, id]);

  const loadTimeline = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setTimelineLoading(true);
    setTimelineError("");
    try {
      const eventPromise = fetchJson<{ items: LeadEvent[] }>(
        `/api/leads/${id}/events?page=1&pageSize=50&sort=createdAt&order=desc`,
        { token }
      );
      const studentPromise = fetchJson<{ items: StudentItem[] }>(
        `/api/students?leadId=${id}&page=1&pageSize=1`,
        { token }
      ).catch(() => ({ items: [] }));
      const leadLogsPromise = fetchJson<{ items: AutomationLog[] }>(
        `/api/automation/logs?leadId=${id}&page=1&pageSize=50`,
        { token }
      ).catch(() => ({ items: [] }));

      const [eventData, studentData, leadLogs] = await Promise.all([eventPromise, studentPromise, leadLogsPromise]);
      const student = studentData.items[0];

      const [receiptData, studentLogs] = student
        ? await Promise.all([
            fetchJson<{ items: ReceiptItem[] }>(`/api/receipts?studentId=${student.id}&page=1&pageSize=50`, { token }).catch(
              () => ({ items: [] })
            ),
            fetchJson<{ items: AutomationLog[] }>(`/api/automation/logs?studentId=${student.id}&page=1&pageSize=50`, {
              token,
            }).catch(() => ({ items: [] })),
          ])
        : [{ items: [] as ReceiptItem[] }, { items: [] as AutomationLog[] }];

      const eventItems: TimelineItem[] = eventData.items.map((event) => ({
        id: `event-${event.id}`,
        source: "event",
        time: event.createdAt,
        title: "Sự kiện khách hàng",
        summary: event.note || `Sự kiện ${event.type}`,
        badgeMain: event.type,
        raw: event,
      }));

      const receiptItems: TimelineItem[] = receiptData.items.map((receipt) => ({
        id: `receipt-${receipt.id}`,
        source: "receipt",
        time: receipt.receivedAt,
        title: "Phiếu thu",
        summary: `${formatCurrencyVnd(receipt.amount)} • ${mapReceiptMethodLabel(receipt.method)}`,
        badgeMain: "THU_TIEN",
        badgeSub: mapReceiptMethodLabel(receipt.method),
        raw: receipt,
      }));

      const logMap = new Map<string, AutomationLog>();
      [...leadLogs.items, ...studentLogs.items].forEach((log) => {
        logMap.set(log.id, log);
      });
      const automationItems: TimelineItem[] = Array.from(logMap.values()).map((log) => ({
        id: `automation-${log.id}`,
        source: "automation",
        time: log.sentAt,
        title: "Automation",
        summary: `Phạm vi ${log.milestone || "-"} • ${log.status}`,
        badgeMain: log.status.toUpperCase(),
        badgeSub: getRuntimeStatus(log.payload, log.status),
        raw: log,
      }));

      const merged = [...eventItems, ...receiptItems, ...automationItems].sort(
        (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
      );
      setTimelineItems(merged);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setTimelineError(`${err.code}: ${err.message}`);
    } finally {
      setTimelineLoading(false);
    }
  }, [handleAuthError, id]);

  useEffect(() => {
    loadLead();
  }, [loadLead]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    fetchMe()
      .then((data) => setCanManageOwner(isAdminRole(data.user.role)))
      .catch(() => setCanManageOwner(false));
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

  useEffect(() => {
    if (tab !== "timeline") return;
    loadTimeline();
  }, [loadTimeline, tab]);

  async function saveOverview() {
    const token = getToken();
    if (!token) return;
    setSaving(true);
    setError("");
    try {
      await fetchJson(`/api/leads/${id}`, {
        method: "PATCH",
        token,
        body: {
          fullName: form.fullName || null,
          phone: form.phone || null,
          source: form.source || null,
          channel: form.channel || null,
          licenseType: form.licenseType || null,
          ownerId: form.ownerId || null,
          note: form.note || null,
          status: form.status,
        },
      });
      await loadLead();
      await loadEvents();
      if (tab === "timeline") await loadTimeline();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`${err.code}: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(next: string) {
    const token = getToken();
    if (!token || !lead) return;
    setSaving(true);
    setError("");
    try {
      await fetchJson(`/api/leads/${id}`, {
        method: "PATCH",
        token,
        body: { status: next },
      });
      await loadLead();
      await loadEvents();
      if (tab === "timeline") await loadTimeline();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`${err.code}: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function addEvent() {
    const token = getToken();
    if (!token) return;
    setSaving(true);
    setError("");
    try {
      const meta = eventMeta.trim() ? JSON.parse(eventMeta) : undefined;
      await fetchJson(`/api/leads/${id}/events`, {
        method: "POST",
        token,
        body: { type: eventType, note: eventNote || undefined, meta },
      });
      setEventType("CALLED");
      setEventNote("");
      setEventMeta("");
      setEventPage(1);
      await loadLead();
      await loadEvents();
      if (tab === "timeline") await loadTimeline();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`${err.code}: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function changeOwner(nextOwnerId: string) {
    const token = getToken();
    if (!token) return;
    setOwnerSaving(true);
    setError("");
    try {
      await fetchJson(`/api/leads/${id}`, {
        method: "PATCH",
        token,
        body: { ownerId: nextOwnerId || null },
      });
      await loadLead();
      await loadEvents();
      if (tab === "timeline") await loadTimeline();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`${err.code}: ${err.message}`);
    } finally {
      setOwnerSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-zinc-700">
        <Spinner /> Đang tải khách hàng...
      </div>
    );
  }

  if (!lead) {
    return <Alert type="error" message={error || "Không tìm thấy khách hàng"} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">{lead.fullName || "Khách hàng chưa có tên"}</h1>
          <p className="text-sm text-zinc-500">{lead.id}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/leads" className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700">
            Quay lại
          </Link>
          <Select value={lead.status} onChange={(e) => changeStatus(e.target.value)} disabled={saving}>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
          <Button onClick={() => setTab("events")}>Thêm sự kiện</Button>
        </div>
      </div>

      {error ? <Alert type="error" message={error} /> : null}

      <div className="flex flex-wrap gap-2">
        <Button variant={tab === "overview" ? "primary" : "secondary"} onClick={() => setTab("overview")}>
          Tổng quan
        </Button>
        <Button variant={tab === "events" ? "primary" : "secondary"} onClick={() => setTab("events")}>
          Nhật ký sự kiện
        </Button>
        <Button variant={tab === "timeline" ? "primary" : "secondary"} onClick={() => setTab("timeline")}>
          Nhật ký
        </Button>
        <Button variant={tab === "activity" ? "primary" : "secondary"} onClick={() => setTab("activity")}>
          Hoạt động
        </Button>
      </div>

      {tab === "overview" ? (
        <div className="space-y-4 rounded-xl bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <Input placeholder="Họ và tên" value={form.fullName} onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))} />
            <Input placeholder="SĐT" value={form.phone} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} />
            <Input placeholder="Nguồn" value={form.source} onChange={(e) => setForm((s) => ({ ...s, source: e.target.value }))} />
            <Input placeholder="Kênh" value={form.channel} onChange={(e) => setForm((s) => ({ ...s, channel: e.target.value }))} />
            <Input placeholder="Hạng bằng" value={form.licenseType} onChange={(e) => setForm((s) => ({ ...s, licenseType: e.target.value }))} />
            {canManageOwner ? (
              <div className="space-y-2">
                <Select value={form.ownerId} onChange={(e) => setForm((s) => ({ ...s, ownerId: e.target.value }))}>
                  <option value="">Chưa gán</option>
                  {owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.name || owner.email}
                    </option>
                  ))}
                </Select>
                <Button
                  variant="secondary"
                  onClick={() => changeOwner(form.ownerId)}
                  disabled={ownerSaving}
                >
                  {ownerSaving ? "Đang đổi người phụ trách..." : "Đổi người phụ trách"}
                </Button>
              </div>
            ) : (
              <Input placeholder="Mã người phụ trách" value={form.ownerId} onChange={(e) => setForm((s) => ({ ...s, ownerId: e.target.value }))} />
            )}
            <div className="md:col-span-2">
              <Input placeholder="Ghi chú" value={form.note} onChange={(e) => setForm((s) => ({ ...s, note: e.target.value }))} />
            </div>
            <Select value={form.status} onChange={(e) => setForm((s) => ({ ...s, status: e.target.value }))}>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
            <div className="flex items-center text-sm text-zinc-500">
              <span>Trạng thái hiện tại: </span>
              <span className="ml-2">
                <Badge text={lead.status} />
              </span>
            </div>
          </div>
            <div className="grid gap-2 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600">
            <div>Ngày tạo: {formatDateTimeVi(lead.createdAt)}</div>
            <div>Cập nhật: {formatDateTimeVi(lead.updatedAt)}</div>
            <div>Liên hệ gần nhất: {lead.lastContactAt ? formatDateTimeVi(lead.lastContactAt) : "-"}</div>
            <div>Người phụ trách hiện tại: {lead.owner?.name || lead.owner?.email || "-"}</div>
          </div>
          <div className="flex justify-end">
            <Button onClick={saveOverview} disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </div>
        </div>
      ) : null}

      {tab === "events" ? (
        <div className="space-y-4 rounded-xl bg-white p-4 shadow-sm">
          <div className="rounded-lg border border-zinc-200 p-3">
            <h2 className="mb-2 text-sm font-semibold text-zinc-900">Thêm sự kiện</h2>
            <div className="grid gap-2 md:grid-cols-3">
              <Select value={eventType} onChange={(e) => setEventType(e.target.value)}>
                {EVENT_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
              <Input placeholder="Ghi chú" value={eventNote} onChange={(e) => setEventNote(e.target.value)} />
              <Input placeholder="Dữ liệu JSON (không bắt buộc)" value={eventMeta} onChange={(e) => setEventMeta(e.target.value)} />
            </div>
            <div className="mt-2 flex justify-end">
              <Button onClick={addEvent} disabled={saving}>
                {saving ? "Đang lưu..." : "Thêm sự kiện"}
              </Button>
            </div>
          </div>

          {eventsLoading ? (
            <div className="text-sm text-zinc-600">Đang tải nhật ký sự kiện...</div>
          ) : events.length === 0 ? (
            <div className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-500">Chưa có sự kiện.</div>
          ) : (
            <div className="space-y-2">
              {events.map((event) => (
                <div key={event.id} className="rounded-lg border border-zinc-200 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <Badge text={event.type} />
                    <span className="text-xs text-zinc-500">{formatDateTimeVi(event.createdAt)}</span>
                  </div>
                  {event.type === "OWNER_CHANGED" ? (
                    <div className="mt-2 rounded bg-zinc-50 p-2 text-xs text-zinc-700">
                      {(() => {
                        const payload = (event.payload as { meta?: { fromOwnerId?: string | null; toOwnerId?: string | null } } | null)?.meta;
                        const fromName = payload?.fromOwnerId ? ownerMap[payload.fromOwnerId] || payload.fromOwnerId : "Chưa gán";
                        const toName = payload?.toOwnerId ? ownerMap[payload.toOwnerId] || payload.toOwnerId : "Chưa gán";
                        return `Đổi người phụ trách: ${fromName} -> ${toName}`;
                      })()}
                    </div>
                  ) : null}
                  {event.payload ? (
                    <pre className="mt-2 overflow-auto rounded bg-zinc-50 p-2 text-xs text-zinc-700">
                      {JSON.stringify(event.payload, null, 2)}
                    </pre>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          <Pagination page={eventPage} pageSize={eventPageSize} total={eventTotal} onPageChange={setEventPage} />
        </div>
      ) : null}

      {tab === "timeline" ? (
        <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["all", "Tất cả"],
                ["event", "Sự kiện"],
                ["receipt", "Thu tiền"],
                ["automation", "Automation"],
              ] as Array<[TimelineFilter, string]>
            ).map(([value, label]) => (
              <Button key={value} variant={timelineFilter === value ? "primary" : "secondary"} onClick={() => setTimelineFilter(value)}>
                {label}
              </Button>
            ))}
            <Button variant="secondary" onClick={loadTimeline} disabled={timelineLoading}>
              {timelineLoading ? "Đang tải..." : "Làm mới"}
            </Button>
          </div>

          {timelineError ? <Alert type="error" message={timelineError} /> : null}

          {timelineLoading ? (
            <div className="flex items-center gap-2 text-sm text-zinc-600">
              <Spinner /> Đang tải nhật ký...
            </div>
          ) : timelineItems.filter((item) => timelineFilter === "all" || item.source === timelineFilter).length === 0 ? (
            <div className="rounded-lg bg-zinc-50 p-4 text-sm text-zinc-600">Không có dữ liệu</div>
          ) : (
            <div className="space-y-2">
              {timelineItems
                .filter((item) => timelineFilter === "all" || item.source === timelineFilter)
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTimelineDetail(item)}
                    className="w-full rounded-lg border border-zinc-200 p-3 text-left hover:bg-zinc-50"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge text={item.badgeMain} />
                        {item.badgeSub ? <Badge text={item.badgeSub} /> : null}
                        <span className="text-sm font-medium text-zinc-900">{item.title}</span>
                      </div>
                      <span className="text-xs text-zinc-500">{formatDateTimeVi(item.time)}</span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-700">{item.summary}</p>
                  </button>
                ))}
            </div>
          )}
        </div>
      ) : null}

      {tab === "activity" ? (
        <div className="space-y-2 rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Mốc tiến trình (sự kiện đầu tiên)</h2>
          {STATUS_OPTIONS.map((status) => (
            <div key={status} className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm">
              <span>{status}</span>
              <span className="text-zinc-600">
                {milestones[status] ? formatDateTimeVi(milestones[status]!.createdAt) : "-"}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <Modal open={Boolean(timelineDetail)} title="Chi tiết nhật ký" onClose={() => setTimelineDetail(null)}>
        {timelineDetail ? (
          <div className="space-y-2">
            <div className="text-sm text-zinc-700">
              <span className="font-semibold">Thời gian: </span>
              {formatDateTimeVi(timelineDetail.time)}
            </div>
            <div className="text-sm text-zinc-700">
              <span className="font-semibold">Tiêu đề: </span>
              {timelineDetail.title}
            </div>
            <pre className="overflow-auto rounded-lg bg-zinc-50 p-3 text-xs text-zinc-700">
              {JSON.stringify(timelineDetail.raw, null, 2)}
            </pre>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
