"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, getToken } from "@/lib/auth-client";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

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
};

type LeadEvent = {
  id: string;
  leadId: string;
  type: string;
  payload?: unknown;
  createdAt: string;
  createdById?: string | null;
};

const STATUS_OPTIONS = ["NEW", "HAS_PHONE", "APPOINTED", "ARRIVED", "SIGNED", "STUDYING", "EXAMED", "RESULT", "LOST"];
const EVENT_OPTIONS = [...STATUS_OPTIONS, "CALLED"];

type TabType = "overview" | "events" | "activity";

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

  const [eventType, setEventType] = useState("CALLED");
  const [eventNote, setEventNote] = useState("");
  const [eventMeta, setEventMeta] = useState("");

  const milestones = useMemo(() => {
    const map: Record<string, LeadEvent | null> = {};
    for (const type of STATUS_OPTIONS) {
      map[type] = events.find((event) => event.type === type) ?? null;
    }
    return map;
  }, [events]);

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

  useEffect(() => {
    loadLead();
  }, [loadLead]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

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
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`${err.code}: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-zinc-700">
        <Spinner /> Loading lead...
      </div>
    );
  }

  if (!lead) {
    return <Alert type="error" message={error || "Lead not found"} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">{lead.fullName || "Unnamed Lead"}</h1>
          <p className="text-sm text-zinc-500">{lead.id}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/leads" className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700">
            Back
          </Link>
          <Select value={lead.status} onChange={(e) => changeStatus(e.target.value)} disabled={saving}>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
          <Button onClick={() => setTab("events")}>Add Event</Button>
        </div>
      </div>

      {error ? <Alert type="error" message={error} /> : null}

      <div className="flex flex-wrap gap-2">
        <Button variant={tab === "overview" ? "primary" : "secondary"} onClick={() => setTab("overview")}>
          Overview
        </Button>
        <Button variant={tab === "events" ? "primary" : "secondary"} onClick={() => setTab("events")}>
          Events
        </Button>
        <Button variant={tab === "activity" ? "primary" : "secondary"} onClick={() => setTab("activity")}>
          Activity
        </Button>
      </div>

      {tab === "overview" ? (
        <div className="space-y-4 rounded-xl bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <Input placeholder="Full name" value={form.fullName} onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))} />
            <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} />
            <Input placeholder="Source" value={form.source} onChange={(e) => setForm((s) => ({ ...s, source: e.target.value }))} />
            <Input placeholder="Channel" value={form.channel} onChange={(e) => setForm((s) => ({ ...s, channel: e.target.value }))} />
            <Input placeholder="License type" value={form.licenseType} onChange={(e) => setForm((s) => ({ ...s, licenseType: e.target.value }))} />
            <Input placeholder="Owner ID" value={form.ownerId} onChange={(e) => setForm((s) => ({ ...s, ownerId: e.target.value }))} />
            <div className="md:col-span-2">
              <Input placeholder="Note" value={form.note} onChange={(e) => setForm((s) => ({ ...s, note: e.target.value }))} />
            </div>
            <Select value={form.status} onChange={(e) => setForm((s) => ({ ...s, status: e.target.value }))}>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
            <div className="flex items-center text-sm text-zinc-500">
              <span>Current status: </span>
              <span className="ml-2">
                <Badge text={lead.status} />
              </span>
            </div>
          </div>
          <div className="grid gap-2 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600">
            <div>Created: {new Date(lead.createdAt).toLocaleString()}</div>
            <div>Updated: {new Date(lead.updatedAt).toLocaleString()}</div>
            <div>Last contact: {lead.lastContactAt ? new Date(lead.lastContactAt).toLocaleString() : "-"}</div>
          </div>
          <div className="flex justify-end">
            <Button onClick={saveOverview} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      ) : null}

      {tab === "events" ? (
        <div className="space-y-4 rounded-xl bg-white p-4 shadow-sm">
          <div className="rounded-lg border border-zinc-200 p-3">
            <h2 className="mb-2 text-sm font-semibold text-zinc-900">Add Event</h2>
            <div className="grid gap-2 md:grid-cols-3">
              <Select value={eventType} onChange={(e) => setEventType(e.target.value)}>
                {EVENT_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
              <Input placeholder="Note" value={eventNote} onChange={(e) => setEventNote(e.target.value)} />
              <Input placeholder="Meta JSON (optional)" value={eventMeta} onChange={(e) => setEventMeta(e.target.value)} />
            </div>
            <div className="mt-2 flex justify-end">
              <Button onClick={addEvent} disabled={saving}>
                {saving ? "Saving..." : "Add Event"}
              </Button>
            </div>
          </div>

          {eventsLoading ? (
            <div className="text-sm text-zinc-600">Loading timeline...</div>
          ) : events.length === 0 ? (
            <div className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-500">No events.</div>
          ) : (
            <div className="space-y-2">
              {events.map((event) => (
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

          <Pagination page={eventPage} pageSize={eventPageSize} total={eventTotal} onPageChange={setEventPage} />
        </div>
      ) : null}

      {tab === "activity" ? (
        <div className="space-y-2 rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Milestones (first event)</h2>
          {STATUS_OPTIONS.map((status) => (
            <div key={status} className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm">
              <span>{status}</span>
              <span className="text-zinc-600">
                {milestones[status] ? new Date(milestones[status]!.createdAt).toLocaleString() : "-"}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
