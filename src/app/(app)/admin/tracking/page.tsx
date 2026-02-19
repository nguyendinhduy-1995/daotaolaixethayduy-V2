"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, getToken } from "@/lib/auth-client";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Table } from "@/components/ui/table";
import { formatDateVi } from "@/lib/date-utils";

type TrackingCode = {
    id: string;
    site: string;
    key: string;
    name: string;
    placement: "HEAD" | "BODY_TOP" | "BODY_BOTTOM";
    code: string;
    isEnabled: boolean;
    updatedAt: string;
};

const SITES = ["ALL", "GLOBAL", "LANDING", "CRM", "STUDENT", "TAPLAI"] as const;
const SITE_OPTIONS = ["GLOBAL", "LANDING", "CRM", "STUDENT", "TAPLAI"] as const;
const PLACEMENT_LABELS: Record<string, string> = { HEAD: "HEAD", BODY_TOP: "BODY (đầu)", BODY_BOTTOM: "BODY (cuối)" };
const SITE_LABELS: Record<string, string> = { GLOBAL: "🌐 Global", LANDING: "🏠 Landing", CRM: "💼 CRM", STUDENT: "🎓 Student", TAPLAI: "🚗 Taplai" };

export default function AdminTrackingPage() {
    const router = useRouter();
    const toast = useToast();
    const [items, setItems] = useState<TrackingCode[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [siteFilter, setSiteFilter] = useState("ALL");
    const [openForm, setOpenForm] = useState(false);
    const [editing, setEditing] = useState<TrackingCode | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<TrackingCode | null>(null);
    const [cloneTarget, setCloneTarget] = useState<TrackingCode | null>(null);
    const [cloneSite, setCloneSite] = useState("LANDING");
    const [form, setForm] = useState({ site: "GLOBAL", key: "", name: "", placement: "HEAD" as string, code: "", isEnabled: true });

    const handleAuthError = useCallback((err: ApiClientError) => {
        if (err.code === "AUTH_MISSING_BEARER" || err.code === "AUTH_INVALID_TOKEN") { clearToken(); router.replace("/login"); return true; }
        return false;
    }, [router]);

    const load = useCallback(async () => {
        const token = getToken(); if (!token) return;
        setLoading(true); setError("");
        try {
            const data = await fetchJson<{ items: TrackingCode[] }>(`/api/admin/tracking-codes?site=${siteFilter}`, { token });
            setItems(data.items);
        } catch (e) { const err = e as ApiClientError; if (!handleAuthError(err)) setError(`${err.code}: ${err.message}`); }
        finally { setLoading(false); }
    }, [handleAuthError, siteFilter]);

    useEffect(() => { void load(); }, [load]);

    async function save() {
        const token = getToken(); if (!token) return; setError("");
        try {
            if (editing) {
                await fetchJson(`/api/admin/tracking-codes/${editing.id}`, { method: "PATCH", token, body: { name: form.name, placement: form.placement, code: form.code, isEnabled: form.isEnabled } });
                toast.success("Đã cập nhật.");
            } else {
                await fetchJson("/api/admin/tracking-codes", { method: "POST", token, body: form });
                toast.success("Đã tạo mã tracking.");
            }
            setOpenForm(false); setEditing(null); resetForm(); await load();
        } catch (e) { const err = e as ApiClientError; if (!handleAuthError(err)) setError(`${err.code}: ${err.message}`); }
    }

    async function toggleEnabled(item: TrackingCode) {
        const token = getToken(); if (!token) return;
        try {
            await fetchJson(`/api/admin/tracking-codes/${item.id}`, { method: "PATCH", token, body: { isEnabled: !item.isEnabled } });
            toast.success(item.isEnabled ? "Đã tắt" : "Đã bật"); await load();
        } catch (e) { const err = e as ApiClientError; if (!handleAuthError(err)) setError(`${err.code}: ${err.message}`); }
    }

    async function deleteCode(item: TrackingCode) {
        const token = getToken(); if (!token) return;
        try {
            await fetchJson(`/api/admin/tracking-codes/${item.id}`, { method: "DELETE", token });
            toast.success("Đã xóa."); setConfirmDelete(null); await load();
        } catch (e) { const err = e as ApiClientError; if (!handleAuthError(err)) setError(`${err.code}: ${err.message}`); }
    }

    async function cloneToSite() {
        if (!cloneTarget) return;
        const token = getToken(); if (!token) return; setError("");
        try {
            let newKey = cloneTarget.key;
            // Check if key exists in target site, auto-suffix
            const existing = items.find((i) => i.site === cloneSite && i.key === newKey);
            if (existing) newKey = `${newKey}_2`;

            await fetchJson("/api/admin/tracking-codes", {
                method: "POST", token,
                body: { site: cloneSite, key: newKey, name: cloneTarget.name, placement: cloneTarget.placement, code: cloneTarget.code, isEnabled: false },
            });
            toast.success(`Đã clone sang ${SITE_LABELS[cloneSite] || cloneSite}`);
            setCloneTarget(null); await load();
        } catch (e) { const err = e as ApiClientError; if (!handleAuthError(err)) setError(`${err.code}: ${err.message}`); }
    }

    function resetForm() { setForm({ site: "GLOBAL", key: "", name: "", placement: "HEAD", code: "", isEnabled: true }); }
    function copyCode(code: string) { navigator.clipboard.writeText(code).then(() => toast.success("Đã copy")); }

    return (
        <div className="space-y-4">
            {/* ── Header ── */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-teal-600 via-emerald-600 to-cyan-600 p-4 text-white shadow-lg shadow-teal-200 animate-fadeInUp">
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
                <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/10 blur-xl" />
                <div className="relative flex flex-wrap items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-2xl backdrop-blur-sm">📡</div>
                    <div className="flex-1">
                        <h2 className="text-lg font-bold">Quản lý mã Tracking</h2>
                        <p className="text-sm text-white/80">Google Tag, Meta Pixel, TikTok Pixel… — multi-site</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={siteFilter}
                            onChange={(e) => setSiteFilter(e.target.value)}
                            className="rounded-xl border border-white/30 bg-white/20 px-3 py-2 text-sm text-white backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-white/40"
                        >
                            {SITES.map((s) => <option key={s} value={s} className="text-zinc-900">{s === "ALL" ? "🔍 Tất cả sites" : SITE_LABELS[s]}</option>)}
                        </select>
                        <Button variant="secondary" onClick={load} disabled={loading} className="!bg-white/20 !text-white !border-white/30 hover:!bg-white/30">
                            {loading ? "..." : "🔄"}
                        </Button>
                        <Button onClick={() => { setEditing(null); resetForm(); setOpenForm(true); }} className="!bg-white !text-teal-700 hover:!bg-white/90">
                            ➕ Thêm
                        </Button>
                    </div>
                </div>
            </div>

            {error ? <Alert type="error" message={error} /> : null}

            {/* ── Table ── */}
            {loading ? (
                <div className="animate-pulse space-y-2">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
                            <div className="h-8 w-8 rounded-lg bg-zinc-200" />
                            <div className="flex-1 space-y-2"><div className="h-4 w-1/3 rounded bg-zinc-200" /><div className="h-3 w-1/4 rounded bg-zinc-100" /></div>
                            <div className="h-6 w-16 rounded-full bg-zinc-200" />
                        </div>
                    ))}
                </div>
            ) : items.length === 0 ? (
                <div className="rounded-xl bg-white p-6 text-sm text-zinc-600 shadow-sm">Chưa có mã tracking nào. Nhấn &quot;Thêm&quot; để bắt đầu.</div>
            ) : (
                <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm animate-fadeInUp" style={{ animationDelay: "80ms" }}>
                    <div className="h-1 bg-gradient-to-r from-teal-500 to-emerald-500" />
                    <Table headers={["Site", "Tên", "Key", "Vị trí", "Trạng thái", "Cập nhật", "Hành động"]}>
                        {items.map((item, idx) => (
                            <tr key={item.id} className="border-t border-zinc-100 transition-colors hover:bg-zinc-50 animate-fadeInUp" style={{ animationDelay: `${80 + Math.min(idx * 30, 200)}ms` }}>
                                <td className="px-3 py-2">
                                    <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">{SITE_LABELS[item.site] || item.site}</span>
                                </td>
                                <td className="px-3 py-2 text-sm font-medium text-zinc-800">{item.name}</td>
                                <td className="px-3 py-2"><code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">{item.key}</code></td>
                                <td className="px-3 py-2 text-sm text-zinc-700">{PLACEMENT_LABELS[item.placement]}</td>
                                <td className="px-3 py-2">
                                    <button onClick={() => toggleEnabled(item)} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${item.isEnabled ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"}`}>
                                        <span className={`h-1.5 w-1.5 rounded-full ${item.isEnabled ? "bg-emerald-500" : "bg-zinc-400"}`} />
                                        {item.isEnabled ? "Bật" : "Tắt"}
                                    </button>
                                </td>
                                <td className="px-3 py-2 text-xs text-zinc-500">{formatDateVi(item.updatedAt)}</td>
                                <td className="px-3 py-2">
                                    <div className="flex items-center gap-1">
                                        <Button variant="secondary" className="h-7 px-2 py-1 text-xs" onClick={() => { setEditing(item); setForm({ site: item.site, key: item.key, name: item.name, placement: item.placement, code: item.code, isEnabled: item.isEnabled }); setOpenForm(true); }}>✏️</Button>
                                        <Button variant="secondary" className="h-7 px-2 py-1 text-xs" onClick={() => copyCode(item.code)}>📋</Button>
                                        <Button variant="secondary" className="h-7 px-2 py-1 text-xs" onClick={() => { setCloneTarget(item); setCloneSite(item.site === "GLOBAL" ? "LANDING" : "GLOBAL"); }}>📑</Button>
                                        <Button variant="secondary" className="h-7 px-2 py-1 text-xs !text-red-600 hover:!bg-red-50" onClick={() => setConfirmDelete(item)}>🗑️</Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </Table>
                </div>
            )}

            {/* ── Create/Edit Modal ── */}
            <Modal open={openForm} title={editing ? "Cập nhật mã tracking" : "Thêm mã tracking"} onClose={() => setOpenForm(false)}>
                <div className="space-y-3">
                    <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600">Site</label>
                        <Select value={form.site} onChange={(e) => setForm((p) => ({ ...p, site: e.target.value }))} disabled={!!editing}>
                            {SITE_OPTIONS.map((s) => <option key={s} value={s}>{SITE_LABELS[s]}</option>)}
                        </Select>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600">Tên hiển thị</label>
                        <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="VD: Google Tag Manager" />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600">Key {editing ? "(không thể sửa)" : ""}</label>
                        <Input value={form.key} onChange={(e) => setForm((p) => ({ ...p, key: e.target.value }))} placeholder="VD: google_tag" disabled={!!editing} className={editing ? "!bg-zinc-100 !text-zinc-500" : ""} />
                        {!editing && <p className="mt-0.5 text-[10px] text-zinc-400">Chỉ chữ thường, số và dấu gạch dưới (_)</p>}
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600">Vị trí chèn</label>
                        <Select value={form.placement} onChange={(e) => setForm((p) => ({ ...p, placement: e.target.value }))}>
                            <option value="HEAD">HEAD</option>
                            <option value="BODY_TOP">BODY (đầu trang)</option>
                            <option value="BODY_BOTTOM">BODY (cuối trang)</option>
                        </Select>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600">Mã snippet</label>
                        <textarea className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 font-mono text-xs leading-relaxed focus:border-teal-400 focus:ring-2 focus:ring-teal-100" rows={10} value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} placeholder="Dán mã tracking tại đây..." spellCheck={false} />
                        <p className="mt-0.5 text-[10px] text-zinc-400">Tối đa 50.000 ký tự</p>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-zinc-700">
                        <input type="checkbox" checked={form.isEnabled} onChange={(e) => setForm((p) => ({ ...p, isEnabled: e.target.checked }))} />
                        Bật (hiện trên {SITE_LABELS[form.site] || form.site})
                    </label>
                    <div className={`rounded-lg border px-3 py-2 text-xs ${form.isEnabled ? "border-green-200 bg-green-50 text-green-700" : "border-zinc-200 bg-zinc-50 text-zinc-500"}`}>
                        {form.isEnabled ? "🟢" : "⚫"} Trạng thái: <strong>{form.isEnabled ? "ON" : "OFF"}</strong> — {SITE_LABELS[form.site] || form.site}
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                        <Button variant="secondary" onClick={() => setOpenForm(false)}>Hủy</Button>
                        <Button onClick={save}>💾 Lưu</Button>
                    </div>
                </div>
            </Modal>

            {/* ── Delete Confirmation ── */}
            <Modal open={!!confirmDelete} title="Xác nhận xóa" onClose={() => setConfirmDelete(null)}>
                <div className="space-y-3">
                    <p className="text-sm text-zinc-700">Xóa <strong>{confirmDelete?.name}</strong> ({confirmDelete?.site}/{confirmDelete?.key})?</p>
                    <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Hủy</Button>
                        <Button className="!bg-red-600 hover:!bg-red-700" onClick={() => confirmDelete && deleteCode(confirmDelete)}>🗑️ Xóa</Button>
                    </div>
                </div>
            </Modal>

            {/* ── Clone Modal ── */}
            <Modal open={!!cloneTarget} title="Clone sang site khác" onClose={() => setCloneTarget(null)}>
                <div className="space-y-3">
                    <p className="text-sm text-zinc-700">Clone <strong>{cloneTarget?.name}</strong> (<code className="text-xs">{cloneTarget?.key}</code>) sang:</p>
                    <Select value={cloneSite} onChange={(e) => setCloneSite(e.target.value)}>
                        {SITE_OPTIONS.filter((s) => s !== cloneTarget?.site).map((s) => <option key={s} value={s}>{SITE_LABELS[s]}</option>)}
                    </Select>
                    <p className="text-[10px] text-zinc-400">Nếu key trùng sẽ tự thêm hậu tố _2. Record mới sẽ ở trạng thái tắt.</p>
                    <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => setCloneTarget(null)}>Hủy</Button>
                        <Button onClick={cloneToSite}>📑 Clone</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
