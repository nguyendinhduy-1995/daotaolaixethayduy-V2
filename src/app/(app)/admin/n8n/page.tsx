"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, fetchMe, getToken } from "@/lib/auth-client";
import { isAdminRole } from "@/lib/admin-auth";
import { useAdminListState } from "@/lib/use-admin-list-state";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Table } from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import { MobileTopbar } from "@/components/admin/mobile-topbar";
import { QuickSearchRow } from "@/components/admin/quick-search-row";
import { FiltersSheet } from "@/components/admin/filters-sheet";
import { AdminCardItem, AdminCardList } from "@/components/admin/admin-card-list";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admin/ui-states";

type N8nWorkflow = {
  id: string;
  name: string;
  objective: string;
  trigger: "cron" | "webhook" | "manual";
  schedule: string;
  inputSources: string[];
  transformLogic: string[];
  apiCalls: Array<{ method: "GET" | "POST"; endpoint: string; headers: string[] }>;
  samplePayload: string;
  idempotency: string;
  retryBackoff: string;
  expectedResult: string;
};

type IngestEndpoint = {
  name: string;
  method: "POST";
  endpoint: string;
  header: string;
  curl: string;
};

type WorkflowsResponse = {
  ok: true;
  definitions: string[];
  securityGuidelines: string[];
  ingestEndpoints: IngestEndpoint[];
  workflows: N8nWorkflow[];
};

function triggerLabel(trigger: N8nWorkflow["trigger"]) {
  if (trigger === "cron") return "Theo lịch";
  if (trigger === "webhook") return "Webhook";
  return "Thủ công";
}

function parseApiError(error: ApiClientError) {
  return `${error.code}: ${error.message}`;
}

export default function AdminN8nPage() {
  const router = useRouter();
  const [checkingRole, setCheckingRole] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [docsData, setDocsData] = useState<WorkflowsResponse | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [triggerFilter, setTriggerFilter] = useState<"" | N8nWorkflow["trigger"]>("");
  const listState = useAdminListState({ query: "", filters: {}, paging: { page: 1, pageSize: 20 } });

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
      .then((data) => setIsAdmin(isAdminRole(data.user.role)))
      .catch(() => {
        clearToken();
        router.replace("/login");
      })
      .finally(() => setCheckingRole(false));
  }, [router]);

  const loadData = useCallback(async () => {
    const token = getToken();
    if (!token || !isAdmin) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson<WorkflowsResponse>("/api/admin/n8n/workflows", { token });
      setDocsData(data);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, [handleAuthError, isAdmin]);

  useEffect(() => {
    if (isAdmin) void loadData();
  }, [isAdmin, loadData]);

  const filteredWorkflows = useMemo(() => {
    const q = listState.debouncedQ.trim().toLowerCase();
    const items = docsData?.workflows ?? [];
    return items.filter((item) => {
      if (triggerFilter && item.trigger !== triggerFilter) return false;
      if (!q) return true;
      return (
        item.id.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.objective.toLowerCase().includes(q) ||
        item.apiCalls.some((api) => api.endpoint.toLowerCase().includes(q))
      );
    });
  }, [docsData?.workflows, listState.debouncedQ, triggerFilter]);

  if (checkingRole) {
    return (
      <div className="flex items-center gap-2 text-zinc-700">
        <Spinner /> Đang kiểm tra quyền...
      </div>
    );
  }

  if (!isAdmin) {
    return <Alert type="error" message="Bạn không có quyền truy cập trang này." />;
  }

  return (
    <div className="space-y-4">
      <MobileTopbar
        title="Luồng n8n"
        subtitle="Tài liệu workflow tích hợp CRM"
        actionNode={
          <Button variant="secondary" className="min-h-11" onClick={() => void loadData()} disabled={loading}>
            Làm mới
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Luồng n8n</h1>
          <p className="text-sm text-zinc-600">Runbook tích hợp ingest, scheduler, worker và callback cho CRM.</p>
        </div>
        <Button variant="secondary" onClick={() => void loadData()} disabled={loading}>
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Spinner /> Đang tải...
            </span>
          ) : (
            "Làm mới"
          )}
        </Button>
      </div>

      {error ? <Alert type="error" message={error} /> : null}

      <QuickSearchRow
        value={listState.q}
        onChange={listState.setQ}
        onOpenFilter={() => setMobileFilterOpen(true)}
        placeholder="Tìm theo mã W, tên workflow, endpoint..."
        activeFilterCount={triggerFilter ? 1 : 0}
      />

      <FiltersSheet
        open={mobileFilterOpen}
        onOpenChange={setMobileFilterOpen}
        title="Bộ lọc luồng n8n"
        onApply={() => undefined}
        onClear={() => {
          setTriggerFilter("");
        }}
      >
        <label className="space-y-1 text-sm text-zinc-700">
          <span>Loại trigger</span>
          <Select value={triggerFilter} onChange={(e) => setTriggerFilter(e.target.value as "" | N8nWorkflow["trigger"])}>
            <option value="">Tất cả</option>
            <option value="cron">Theo lịch</option>
            <option value="webhook">Webhook</option>
            <option value="manual">Thủ công</option>
          </Select>
        </label>
      </FiltersSheet>

      {loading ? <LoadingSkeleton text="Đang tải tài liệu workflow..." /> : null}
      {!loading && error ? <ErrorState detail={error} /> : null}

      {!loading && docsData ? (
        <>
          <section className="surface space-y-3 p-4">
            <h2 className="text-base font-semibold text-slate-900">Tổng quan</h2>
            <p className="text-sm text-zinc-700">
              Luồng n8n dùng để đồng bộ dữ liệu vận hành theo lịch/webhook vào CRM bằng API secret-based.
            </p>
            <div className="space-y-1 text-sm text-zinc-700">
              {docsData.definitions.map((line, idx) => (
                <p key={`def-${idx}`}>- {line}</p>
              ))}
            </div>
            <div className="space-y-1 text-sm text-zinc-700">
              {docsData.securityGuidelines.map((line, idx) => (
                <p key={`sec-${idx}`}>- {line}</p>
              ))}
            </div>
          </section>

          <section className="surface space-y-3 p-4">
            <h2 className="text-base font-semibold text-slate-900">API & Secret</h2>
            <div className="hidden md:block">
              <Table headers={["Tên", "Method", "Endpoint", "Header bắt buộc"]}>
                {docsData.ingestEndpoints.map((item) => (
                  <tr key={item.endpoint} className="border-t border-zinc-100">
                    <td className="px-3 py-2 text-sm text-zinc-900">{item.name}</td>
                    <td className="px-3 py-2 text-sm text-zinc-700">{item.method}</td>
                    <td className="px-3 py-2 text-xs text-zinc-700">{item.endpoint}</td>
                    <td className="px-3 py-2 text-xs text-zinc-700">{item.header}</td>
                  </tr>
                ))}
              </Table>
            </div>
            <AdminCardList>
              {docsData.ingestEndpoints.map((item) => (
                <AdminCardItem
                  key={`api-${item.endpoint}`}
                  title={item.name}
                  subtitle={`${item.method} ${item.endpoint}`}
                  meta={<p>{item.header}</p>}
                >
                  <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-2 text-xs text-zinc-100">{item.curl}</pre>
                </AdminCardItem>
              ))}
            </AdminCardList>
          </section>

          <section className="surface space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900">Danh sách workflow (W1..Wn)</h2>
              <div className="hidden md:block w-52">
                <Select value={triggerFilter} onChange={(e) => setTriggerFilter(e.target.value as "" | N8nWorkflow["trigger"])}>
                  <option value="">Tất cả trigger</option>
                  <option value="cron">Theo lịch</option>
                  <option value="webhook">Webhook</option>
                  <option value="manual">Thủ công</option>
                </Select>
              </div>
            </div>

            {filteredWorkflows.length === 0 ? (
              <EmptyState text="Không có workflow phù hợp bộ lọc." />
            ) : (
              <>
                <div className="hidden md:block space-y-4">
                  {filteredWorkflows.map((flow) => (
                    <article key={flow.id} className="rounded-xl border border-zinc-200 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge text={flow.id} tone="accent" />
                        <h3 className="text-sm font-semibold text-zinc-900">{flow.name}</h3>
                        <Badge text={triggerLabel(flow.trigger)} />
                      </div>
                      <p className="mt-2 text-sm text-zinc-700">{flow.objective}</p>
                      <p className="mt-1 text-xs text-zinc-600">Chu kỳ chạy: {flow.schedule}</p>
                      <p className="mt-1 text-xs text-zinc-600">Nguồn dữ liệu: {flow.inputSources.join(", ")}</p>
                      <p className="mt-2 text-xs font-medium text-zinc-700">API CRM gọi:</p>
                      {flow.apiCalls.map((api, idx) => (
                        <p key={`${flow.id}-api-${idx}`} className="text-xs text-zinc-600">
                          - {api.method} {api.endpoint} | headers: {api.headers.join(", ")}
                        </p>
                      ))}
                      <p className="mt-2 text-xs font-medium text-zinc-700">Payload mẫu</p>
                      <pre className="mt-1 overflow-x-auto rounded-lg bg-zinc-900 p-2 text-xs text-zinc-100">{flow.samplePayload}</pre>
                      <p className="mt-2 text-xs text-zinc-700">Idempotency: {flow.idempotency}</p>
                      <p className="text-xs text-zinc-700">Retry/backoff: {flow.retryBackoff}</p>
                      <p className="text-xs text-zinc-700">Kết quả mong đợi: {flow.expectedResult}</p>
                    </article>
                  ))}
                </div>

                <AdminCardList>
                  {filteredWorkflows.map((flow) => (
                    <AdminCardItem
                      key={`mobile-${flow.id}`}
                      title={`${flow.id} - ${flow.name}`}
                      subtitle={`Trigger: ${triggerLabel(flow.trigger)} • ${flow.schedule}`}
                      meta={
                        <div className="space-y-1">
                          <p>{flow.objective}</p>
                          <p>Endpoint: {flow.apiCalls.map((api) => `${api.method} ${api.endpoint}`).join(" | ")}</p>
                        </div>
                      }
                    >
                      <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-2 text-xs text-zinc-100">{flow.samplePayload}</pre>
                    </AdminCardItem>
                  ))}
                </AdminCardList>
              </>
            )}
          </section>

          <section className="surface space-y-3 p-4">
            <h2 className="text-base font-semibold text-slate-900">Runbook n8n</h2>
            <div className="space-y-1 text-sm text-zinc-700">
              <p>- Bước 1: Tạo node Trigger (Cron hoặc Webhook) theo workflow tương ứng.</p>
              <p>- Bước 2: Thêm node chuẩn hóa payload (Set/Function) đúng định nghĩa metrics/dateKey.</p>
              <p>- Bước 3: Gọi HTTP Request tới API CRM với secret header tương ứng.</p>
              <p>- Bước 4: Thêm IF node kiểm tra statusCode; lỗi thì gửi cảnh báo + retry.</p>
              <p>- Bước 5: Đối chiếu kết quả trên CRM (/admin/ops, /marketing, /automation/logs).</p>
            </div>
            <div className="space-y-1 text-sm text-zinc-700">
              <p className="font-medium">Troubleshooting nhanh</p>
              <p>- 401/403: kiểm tra secret header hoặc endpoint admin cần cookie session.</p>
              <p>- 400/422: payload sai schema (đặc biệt dateKey, metrics kiểu số nguyên).</p>
              <p>- 500: kiểm tra DB/service logs, thử dryRun với payload nhỏ trước.</p>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
