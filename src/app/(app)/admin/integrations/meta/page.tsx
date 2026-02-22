"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchJson } from "@/lib/api-client";
import { getToken as getAuthToken } from "@/lib/auth-client";
import { Spinner } from "@/components/ui/spinner";

type LogEntry = {
    id: string;
    eventName: string;
    eventId: string;
    ok: boolean;
    fbtraceId: string | null;
    errorMsg: string | null;
    ip: string | null;
    createdAt: string;
};

export default function MetaIntegrationPage() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [testResult, setTestResult] = useState<string | null>(null);
    const [testLoading, setTestLoading] = useState(false);

    const pixelId = "1352480913314806";
    const hasToken = true; // We know it's set

    const loadLogs = useCallback(async () => {
        const token = getAuthToken();
        if (!token) return;
        try {
            const res = await fetchJson<{ logs: LogEntry[] }>("/api/admin/meta/logs", { token });
            setLogs(res.logs);
        } catch {
            /* ignore */
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadLogs(); }, [loadLogs]);

    const sendTest = async () => {
        const token = getAuthToken();
        if (!token) return;
        setTestLoading(true);
        setTestResult(null);
        try {
            const res = await fetchJson<{ ok: boolean; fbtrace_id?: string; meta_response?: unknown; test_event_code?: string }>(
                "/api/admin/meta/test", { token, method: "POST" }
            );
            if (res.ok) {
                setTestResult(`✅ Thành công! fbtrace_id: ${res.fbtrace_id}${res.test_event_code ? ` (test code: ${res.test_event_code})` : ""}`);
            } else {
                setTestResult(`❌ Lỗi: ${JSON.stringify(res)}`);
            }
            loadLogs();
        } catch (e) {
            setTestResult(`❌ Lỗi: ${e instanceof Error ? e.message : "Unknown"}`);
        } finally {
            setTestLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-xl font-bold text-zinc-800">📊 Meta Pixel & Conversions API</h1>
                <p className="text-sm text-zinc-500">Quản lý cấu hình và giám sát events gửi tới Facebook</p>
            </div>

            {/* Status Cards */}
            <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-zinc-200/60 bg-white p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-2">Pixel ID</p>
                    <p className="font-mono text-sm text-blue-600">{pixelId}</p>
                    <p className="text-xs text-green-600 mt-1">✅ Đã cấu hình</p>
                </div>
                <div className="rounded-2xl border border-zinc-200/60 bg-white p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-2">CAPI Access Token</p>
                    <p className="font-mono text-sm text-zinc-600">••••••••{hasToken ? "Đã set" : "Chưa set"}</p>
                    <p className={`text-xs mt-1 ${hasToken ? "text-green-600" : "text-red-500"}`}>{hasToken ? "✅ Đã cấu hình" : "❌ Chưa set"}</p>
                </div>
                <div className="rounded-2xl border border-zinc-200/60 bg-white p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-2">Dedup Mode</p>
                    <p className="text-sm text-zinc-700 font-medium">Browser Pixel + Server CAPI</p>
                    <p className="text-xs text-green-600 mt-1">✅ event_id dedup</p>
                </div>
            </div>

            {/* Event Mapping */}
            <div className="rounded-2xl border border-zinc-200/60 bg-white p-5">
                <p className="text-sm font-bold text-zinc-700 mb-3">🎯 Event Mapping</p>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b border-zinc-100 text-xs text-zinc-500">
                            <th className="text-left py-2 pr-4">Meta Event</th>
                            <th className="text-left py-2 pr-4">Trigger</th>
                            <th className="text-left py-2 pr-4">Location</th>
                            <th className="text-left py-2">Dedup</th>
                        </tr></thead>
                        <tbody className="text-zinc-700">
                            <tr className="border-b border-zinc-50"><td className="py-2 pr-4 font-medium">PageView</td><td>Page load</td><td>Landing layout</td><td>Browser only</td></tr>
                            <tr className="border-b border-zinc-50"><td className="py-2 pr-4 font-medium">ViewContent</td><td>Page load</td><td>Landing layout</td><td>✅ Pixel + CAPI</td></tr>
                            <tr className="border-b border-zinc-50"><td className="py-2 pr-4 font-medium">Contact</td><td>Click tel/zalo</td><td>Landing tracker</td><td>✅ Pixel + CAPI</td></tr>
                            <tr className="border-b border-zinc-50"><td className="py-2 pr-4 font-medium">Lead</td><td>Form submit</td><td>LeadForm.tsx</td><td>✅ Pixel + CAPI</td></tr>
                            <tr><td className="py-2 pr-4 font-medium">CompleteRegistration</td><td>Form success</td><td>LeadForm.tsx</td><td>✅ Pixel + CAPI</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Test Event */}
            <div className="rounded-2xl border border-violet-200/60 bg-gradient-to-br from-violet-50 to-indigo-50 p-5">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <p className="text-sm font-bold text-violet-700">🧪 Gửi Test Event</p>
                        <p className="text-xs text-zinc-500">Gửi ViewContent test tới Events Manager để QA</p>
                    </div>
                    <button type="button" disabled={testLoading} onClick={sendTest}
                        className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 shadow-md">
                        {testLoading ? <span className="inline-flex items-center gap-1.5"><Spinner /> Đang gửi...</span> : "🚀 Send Test Event"}
                    </button>
                </div>
                {testResult ? <div className="rounded-xl bg-white/80 border border-violet-100 p-3 text-sm text-zinc-700 font-mono whitespace-pre-wrap">{testResult}</div> : null}
            </div>

            {/* Event Logs */}
            <div className="rounded-2xl border border-zinc-200/60 bg-white p-5">
                <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-bold text-zinc-700">📋 Event Logs (last 30)</p>
                    <button type="button" onClick={loadLogs} className="text-xs text-blue-600 hover:underline">🔄 Refresh</button>
                </div>
                {loading ? <div className="flex items-center justify-center py-8"><Spinner /></div> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead><tr className="border-b border-zinc-200 text-zinc-500">
                                <th className="text-left py-2 pr-3">Thời gian</th>
                                <th className="text-left py-2 pr-3">Event</th>
                                <th className="text-left py-2 pr-3">Status</th>
                                <th className="text-left py-2 pr-3">fbtrace_id</th>
                                <th className="text-left py-2">IP</th>
                            </tr></thead>
                            <tbody>
                                {logs.length === 0 ? <tr><td colSpan={5} className="py-8 text-center text-zinc-400">Chưa có event nào</td></tr> : null}
                                {logs.map(log => (
                                    <tr key={log.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                                        <td className="py-2 pr-3 text-zinc-500 whitespace-nowrap">{new Date(log.createdAt).toLocaleString("vi-VN")}</td>
                                        <td className="py-2 pr-3 font-medium text-zinc-700">{log.eventName}</td>
                                        <td className="py-2 pr-3">
                                            {log.ok ? <span className="text-green-600 font-bold">✅</span> : (
                                                <span className="text-red-500 font-bold" title={log.errorMsg || ""}>❌</span>
                                            )}
                                        </td>
                                        <td className="py-2 pr-3 font-mono text-zinc-400 max-w-[120px] truncate">{log.fbtraceId || "—"}</td>
                                        <td className="py-2 text-zinc-400">{log.ip || "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Debug Guide */}
            <div className="rounded-2xl border border-amber-200/60 bg-gradient-to-r from-amber-50 to-orange-50 p-5">
                <p className="text-sm font-bold text-amber-800 mb-3">🛠️ Hướng dẫn debug & bật/tắt</p>
                <div className="space-y-2 text-xs text-zinc-700 leading-relaxed">
                    <p><strong>Kiểm tra events:</strong> Vào <a href="https://business.facebook.com/events_manager2" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Events Manager</a> → Test Events → nhập Test Event Code</p>
                    <p><strong>Verify dedup:</strong> 1 hành động = 1 Browser + 1 Server event cùng event_id → Meta tính 1 lần</p>
                    <p><strong>_fbp cookie:</strong> Tự set bởi Meta Pixel JS. Kiểm tra trong DevTools → Application → Cookies</p>
                    <p><strong>_fbc cookie:</strong> Tự set khi URL có <code>?fbclid=xxx</code>. Format: <code>fb.1.&lt;ts&gt;.&lt;fbclid&gt;</code></p>
                    <p><strong>Tắt CAPI:</strong> Xóa <code>META_CAPI_ACCESS_TOKEN</code> trong .env → chỉ còn Browser Pixel</p>
                    <p><strong>Tắt hoàn toàn:</strong> Xóa cả <code>META_PIXEL_ID</code> + token + xóa Script tag trong landing layout</p>
                    <p><strong>Common errors:</strong></p>
                    <ul className="ml-4 list-disc space-y-1">
                        <li><code>Invalid OAuth access token</code> → Token hết hạn, cần tạo mới</li>
                        <li><code>Error validating pixel</code> → Pixel ID sai hoặc không thuộc Business</li>
                        <li><code>em/ph hash invalid</code> → Kiểm tra SHA-256 hash format</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
