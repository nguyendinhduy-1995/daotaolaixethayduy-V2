"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { API_CATALOG, type ApiCatalogItem } from "@/lib/api-catalog";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fetchMe } from "@/lib/auth-client";
import { hasUiPermission } from "@/lib/ui-permissions";
import { fetchJson, type ApiClientError } from "@/lib/api-client";

const MODULE_ORDER = [
  "Tổng quan",
  "Khách hàng",
  "Bảng trạng thái",
  "KPI ngày",
  "Mục tiêu KPI",
  "Mục tiêu ngày/tháng",
  "Trợ lý công việc",
  "Học viên",
  "Khóa học",
  "Lịch học",
  "Thu tiền",
  "Thông báo",
  "Gửi tin",
  "Lương tôi",
  "AI hỗ trợ nhân sự",
  "Luồng n8n",
  "Tự động hóa - Nhật ký",
  "Tự động hóa - Chạy tay",
  "Báo cáo Meta Ads",
  "Chi nhánh",
  "Người dùng",
  "Phân khách hàng",
  "Bảng học phí",
  "Quản trị thông báo",
  "Vận hành tự động",
  "Tiến trình gửi tin",
  "Lập lịch",
  "Nội dung học viên",
  "KPI nhân sự",
  "Hồ sơ lương",
  "Chấm công",
  "Tổng lương",
] as const;

function methodClass(method: ApiCatalogItem["method"]) {
  if (method === "GET") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (method === "POST") return "bg-blue-50 text-blue-700 border-blue-200";
  if (method === "PATCH") return "bg-amber-50 text-amber-700 border-amber-200";
  if (method === "PUT") return "bg-violet-50 text-violet-700 border-violet-200";
  return "bg-rose-50 text-rose-700 border-rose-200";
}

export default function ApiHubPage() {
  const router = useRouter();
  const guardStartedRef = useRef(false);
  const [query, setQuery] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"api" | "n8n">("api");
  const [workflows, setWorkflows] = useState<Array<{
    id: string;
    name: string;
    objective: string;
    trigger: string;
    schedule: string;
    apiCalls: Array<{ method: string; endpoint: string; headers: string[] }>;
    retryBackoff: string;
    idempotency: string;
  }>>([]);

  const loadPermission = useCallback(async () => {
    setLoading(true);
    setError("");
    setUnauthorized(false);
    setForbidden(false);
    try {
      const me = await Promise.race([
        fetchMe(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), 10000)),
      ]);
      const canView = hasUiPermission(me.user.permissions, "api_hub", "VIEW");
      setForbidden(!canView);
    } catch (e) {
      const err = e as ApiClientError;
      if (err?.status === 401 || err?.code?.startsWith("AUTH_")) {
        setUnauthorized(true);
        router.replace("/login");
        return;
      }
      if (err?.status === 403 || err?.code === "AUTH_FORBIDDEN") {
        setForbidden(true);
        return;
      }
      setError("Không thể kiểm tra quyền truy cập. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (guardStartedRef.current) return;
    guardStartedRef.current = true;
    void loadPermission();
  }, [loadPermission]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return API_CATALOG;
    return API_CATALOG.filter((item) => {
      const haystack = [
        item.module,
        item.name,
        item.method,
        item.path,
        item.description,
        item.auth,
        ...(item.params || []),
        ...(item.body || []),
        ...(item.tags || []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [query]);

  const grouped = useMemo(() => {
    const map = new Map<string, ApiCatalogItem[]>();
    for (const item of filtered) {
      const rows = map.get(item.module) || [];
      rows.push(item);
      map.set(item.module, rows);
    }
    return MODULE_ORDER.map((module) => ({ module, items: map.get(module) || [] })).filter((g) => g.items.length > 0);
  }, [filtered]);

  async function copyText(id: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(""), 1200);
  }

  const loadN8nWorkflows = useCallback(async () => {
    try {
      const data = await fetchJson<{
        workflows: Array<{
          id: string;
          name: string;
          objective: string;
          trigger: string;
          schedule: string;
          apiCalls: Array<{ method: string; endpoint: string; headers: string[] }>;
          retryBackoff: string;
          idempotency: string;
        }>;
      }>("/api/admin/n8n/workflows");
      setWorkflows(Array.isArray(data.workflows) ? data.workflows : []);
    } catch {
      setWorkflows([]);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "n8n") {
      void loadN8nWorkflows();
    }
  }, [activeTab, loadN8nWorkflows]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
        Đang kiểm tra quyền truy cập...
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <Alert type="error" message={error} />
        <Button variant="secondary" onClick={() => void loadPermission()}>
          Thử lại
        </Button>
      </div>
    );
  }

  if (forbidden) {
    return <Alert type="error" message="Bạn không có quyền truy cập" />;
  }

  if (unauthorized) {
    return <Alert type="error" message="Phiên đăng nhập không hợp lệ. Đang chuyển đến trang đăng nhập..." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">API Hub</h1>
          <p className="text-sm text-zinc-500">Tra cứu nhanh API để tích hợp hệ thống bên ngoài.</p>
        </div>
      </div>

      <Alert type="info" message="Không dán token thật vào tài liệu hoặc ảnh chụp màn hình. Mọi ví dụ bên dưới dùng token REDACTED." />

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Tích hợp</h2>
        <div className="mt-2 space-y-1 text-sm text-zinc-700">
          <p>
            <span className="font-medium text-zinc-900">Base URL:</span> `http://localhost:3000` (local), staging/prod dùng
            placeholder trong spec.
          </p>
          <p>
            <span className="font-medium text-zinc-900">Auth:</span> `POST /api/auth/login` lấy token Bearer, sau đó làm mới qua
            `POST /api/auth/refresh`.
          </p>
          <p>
            <span className="font-medium text-zinc-900">Idempotency:</span> gửi `Idempotency-Key` cho các API tạo mới như phiếu
            thu, outbound jobs, dispatch outbound, lịch học, ingest AI.
          </p>
          <p>
            <span className="font-medium text-zinc-900">Webhook:</span> callback outbound tại `POST /api/outbound/callback`,
            header hiện dùng `x-callback-secret` (có placeholder `x-signature` trong spec).
          </p>
        </div>
        <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
          <p className="font-semibold uppercase tracking-wide text-zinc-500">Tài liệu repo</p>
          <p className="mt-1 font-mono">PERMISSION_MATRIX.md</p>
          <p className="font-mono">API_INTEGRATION_SPEC.md</p>
        </div>
      </section>

      <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
        <div className="mb-3 inline-flex rounded-xl border border-zinc-200 bg-zinc-50 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("api")}
            className={`rounded-lg px-3 py-1.5 text-sm ${activeTab === "api" ? "bg-white text-zinc-900 shadow" : "text-zinc-600"}`}
          >
            API tích hợp
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("n8n")}
            className={`rounded-lg px-3 py-1.5 text-sm ${activeTab === "n8n" ? "bg-white text-zinc-900 shadow" : "text-zinc-600"}`}
          >
            Luồng tự động (n8n)
          </button>
        </div>
        {activeTab === "api" ? (
          <Input
            placeholder="Tìm API..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        ) : null}
      </div>

      {activeTab === "api" && grouped.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-600">
          Không tìm thấy API phù hợp.
        </div>
      ) : null}

      {activeTab === "api" ? (
        grouped.map((group) => (
          <section key={group.module} className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900">{group.module}</h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {group.items.map((api) => (
                <article key={api.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${methodClass(api.method)}`}>
                      {api.method}
                    </span>
                    <h3 className="text-sm font-semibold text-zinc-900">{api.name}</h3>
                  </div>

                  <p className="font-mono text-xs text-zinc-700">{api.path}</p>
                  <p className="mt-1 text-sm text-zinc-600">{api.description}</p>
                  <p className="mt-1 text-xs text-zinc-500">Xác thực: {api.auth}</p>

                  {api.params && api.params.length > 0 ? (
                    <div className="mt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Params</p>
                      <pre className="mt-1 overflow-auto rounded-xl bg-zinc-50 p-2 text-xs text-zinc-700">{api.params.join("\n")}</pre>
                    </div>
                  ) : null}

                  {api.body && api.body.length > 0 ? (
                    <div className="mt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Body Schema</p>
                      <pre className="mt-1 overflow-auto rounded-xl bg-zinc-50 p-2 text-xs text-zinc-700">{api.body.join("\n")}</pre>
                    </div>
                  ) : null}

                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Response mẫu</p>
                      <Button variant="secondary" className="h-8 px-2 text-xs" onClick={() => copyText(`${api.id}-res`, api.response)}>
                        {copiedId === `${api.id}-res` ? "Đã sao chép" : "Sao chép"}
                      </Button>
                    </div>
                    <pre className="overflow-auto rounded-xl bg-zinc-50 p-2 text-xs text-zinc-700">{api.response}</pre>
                  </div>

                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Ví dụ curl</p>
                      <Button variant="secondary" className="h-8 px-2 text-xs" onClick={() => copyText(`${api.id}-curl`, api.curl)}>
                        {copiedId === `${api.id}-curl` ? "Đã sao chép" : "Sao chép"}
                      </Button>
                    </div>
                    <pre className="overflow-auto rounded-xl bg-zinc-50 p-2 text-xs text-zinc-700">{api.curl}</pre>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))
      ) : null}

      {activeTab === "n8n" ? (
        <div className="space-y-3">
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Cách đấu nối nhanh</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
              <li>Dùng node HTTP Request trong n8n để gọi endpoint ingest.</li>
              <li>Gửi header <code>x-service-token: REDACTED</code> và <code>Idempotency-Key: REDACTED-UUID</code>.</li>
              <li>Bật retry 3 lần với giãn cách tăng dần để tránh mất dữ liệu.</li>
              <li>Không dán token thật vào màn hình hoặc tài liệu chia sẻ.</li>
            </ul>
          </section>

          {workflows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-600">
              Chưa có dữ liệu luồng tự động.
            </div>
          ) : (
            workflows.map((wf) => (
              <article key={wf.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-zinc-900">{wf.name}</h3>
                <div className="mt-2 grid gap-2 text-sm text-zinc-700 md:grid-cols-2">
                  <p><span className="font-medium text-zinc-900">Mục tiêu:</span> {wf.objective}</p>
                  <p><span className="font-medium text-zinc-900">Kích hoạt:</span> {wf.trigger} - {wf.schedule}</p>
                  <p><span className="font-medium text-zinc-900">Retry/backoff:</span> {wf.retryBackoff}</p>
                  <p><span className="font-medium text-zinc-900">Idempotency:</span> {wf.idempotency}</p>
                </div>
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Điểm vào/ra API</p>
                  <ul className="mt-1 space-y-1 text-sm text-zinc-700">
                    {wf.apiCalls.map((call, idx) => (
                      <li key={`${wf.id}-${idx}`}>
                        <code>{call.method} {call.endpoint}</code> - Header: {call.headers.join(", ")}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
