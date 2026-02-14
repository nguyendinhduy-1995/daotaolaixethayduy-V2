"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, fetchMe, getToken } from "@/lib/auth-client";
import { isAdminRole } from "@/lib/admin-auth";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { formatDateTimeVi } from "@/lib/date-utils";

type HealthResponse = {
  serverTime: string;
  serverTimeTz: string;
  tz: string;
  outbound: {
    queued: number;
    failed: number;
    sentLast24h: number;
    nextAttemptSoonCount: number;
    byPriority: { HIGH: number; MEDIUM: number; LOW: number };
    byOwner: Array<{ ownerId: string; ownerName: string; count: number }>;
  };
  automation: {
    outboundWorker: { lastRunAt: string | null; deliveryStatus: string | null; runtimeStatus: string | null; output: Record<string, unknown> };
    cronDaily: { lastRunAt: string | null; deliveryStatus: string | null; runtimeStatus: string | null; output: Record<string, unknown> };
  };
  warnings: string[];
};

type DryRunResult = {
  ok: boolean;
  dryRun: boolean;
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  rateLimited: number;
  remainingEstimate: number;
  breakdownByPriority: { HIGH: number; MEDIUM: number; LOW: number };
  breakdownByOwner: Array<{ ownerId: string; ownerName: string; count: number }>;
  warnings?: string[];
};

function formatApiError(err: ApiClientError) {
  return `${err.code}: ${err.message}`;
}

export default function AdminSchedulerPage() {
  const router = useRouter();
  const [checkingRole, setCheckingRole] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [runningDry, setRunningDry] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [dryResult, setDryResult] = useState<DryRunResult | null>(null);
  const [openResult, setOpenResult] = useState(false);

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

  const loadHealth = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson<HealthResponse>("/api/admin/scheduler/health", { token });
      setHealth(data);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, [handleAuthError]);

  useEffect(() => {
    fetchMe()
      .then((data) => setIsAdmin(isAdminRole(data.user.role)))
      .catch(() => {
        clearToken();
        router.replace("/login");
      })
      .finally(() => setCheckingRole(false));
  }, [router]);

  useEffect(() => {
    if (isAdmin) void loadHealth();
  }, [isAdmin, loadHealth]);

  async function runDry() {
    const token = getToken();
    if (!token) return;
    setRunningDry(true);
    setError("");
    setSuccess("");
    try {
      const data = await fetchJson<DryRunResult>("/api/admin/worker/outbound", {
        method: "POST",
        token,
        body: { dryRun: true, batchSize: 50, force: false },
      });
      setDryResult(data);
      setOpenResult(true);
      setSuccess("Đã chạy thử worker thành công.");
      await loadHealth();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(formatApiError(err));
    } finally {
      setRunningDry(false);
    }
  }

  const endpointUrl = useMemo(() => {
    if (typeof window === "undefined") return "https://<host>/api/worker/outbound";
    return `${window.location.origin}/api/worker/outbound`;
  }, []);

  if (checkingRole) {
    return (
      <div className="flex items-center gap-2 text-zinc-700">
        <Spinner /> Đang kiểm tra quyền...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-3 rounded-xl bg-white p-6 shadow-sm">
        <Alert type="error" message="Bạn không có quyền truy cập." />
        <Link href="/dashboard" className="inline-block rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700">
          Về tổng quan
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-900">Bộ lập lịch (n8n)</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={loadHealth} disabled={loading}>
            {loading ? "Đang tải..." : "Làm mới"}
          </Button>
          <Button onClick={runDry} disabled={runningDry}>
            {runningDry ? "Đang chạy..." : "Chạy thử (dry-run)"}
          </Button>
        </div>
      </div>

      {error ? <Alert type="error" message={error} /> : null}
      {success ? <Alert type="success" message={success} /> : null}
      {health?.warnings.map((w) => <Alert key={w} type="error" message={w} />)}

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Hàng chờ</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{health?.outbound.queued ?? 0}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Tin lỗi</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{health?.outbound.failed ?? 0}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Đã gửi 24h</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{health?.outbound.sentLast24h ?? 0}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Sắp tới lượt gửi</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{health?.outbound.nextAttemptSoonCount ?? 0}</p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-zinc-900">Worker Outbound</p>
          <p className="mt-2 text-sm text-zinc-700">Ưu tiên cao: {health?.outbound.byPriority.HIGH ?? 0}</p>
          <p className="text-sm text-zinc-700">Ưu tiên trung bình: {health?.outbound.byPriority.MEDIUM ?? 0}</p>
          <p className="text-sm text-zinc-700">Ưu tiên thấp: {health?.outbound.byPriority.LOW ?? 0}</p>
          <p className="mt-2 text-xs text-zinc-500">Giờ máy chủ: {health ? `${health.serverTimeTz} (${health.tz})` : "-"}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-zinc-900">Nhật ký chạy gần nhất</p>
          <p className="mt-2 text-sm text-zinc-700">
            Cron daily: {health?.automation.cronDaily.lastRunAt ? formatDateTimeVi(health.automation.cronDaily.lastRunAt) : "Chưa có"}
          </p>
          <p className="text-xs text-zinc-500">Trạng thái: {health?.automation.cronDaily.runtimeStatus || "-"}</p>
          <p className="mt-2 text-sm text-zinc-700">
            Outbound worker: {health?.automation.outboundWorker.lastRunAt ? formatDateTimeVi(health.automation.outboundWorker.lastRunAt) : "Chưa có"}
          </p>
          <p className="text-xs text-zinc-500">Trạng thái: {health?.automation.outboundWorker.runtimeStatus || "-"}</p>
        </div>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <p className="text-sm font-medium text-zinc-900">Hướng dẫn n8n</p>
        <div className="mt-3 space-y-3 text-sm text-zinc-700">
          <p>1. Tạo node Cron trong n8n với tần suất mỗi 1-2 phút.</p>
          <p>2. Thêm node HTTP Request gọi endpoint worker:</p>
          <pre className="rounded-lg bg-zinc-900 p-3 text-xs text-zinc-100">{endpointUrl}</pre>
          <p>3. Header bắt buộc:</p>
          <pre className="rounded-lg bg-zinc-900 p-3 text-xs text-zinc-100">{`x-worker-secret: <WORKER_SECRET>\nContent-Type: application/json`}</pre>
          <p>4. Body mẫu:</p>
          <pre className="rounded-lg bg-zinc-900 p-3 text-xs text-zinc-100">{`{"dryRun":false,"batchSize":50,"force":false}`}</pre>
          <p>5. Gợi ý cảnh báo: nếu `failed &gt; 0` hoặc `queued` tăng cao thì gửi cảnh báo Telegram/Email.</p>
          <p>6. Test local nhanh bằng curl:</p>
          <pre className="rounded-lg bg-zinc-900 p-3 text-xs text-zinc-100">{`curl -X POST ${endpointUrl} \\\n  -H "x-worker-secret: $WORKER_SECRET" \\\n  -H "Content-Type: application/json" \\\n  -d '{"dryRun":true,"batchSize":20}'`}</pre>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/outbound?status=QUEUED" className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700">
          Xem hàng chờ
        </Link>
        <Link href="/outbound?status=FAILED" className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700">
          Xem tin lỗi
        </Link>
        <Link href="/automation/logs?scope=outbound-worker" className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700">
          Xem nhật ký worker
        </Link>
      </div>

      <Modal open={openResult} title="Kết quả chạy thử worker" onClose={() => setOpenResult(false)}>
        <pre className="max-h-[420px] overflow-auto rounded-lg bg-zinc-900 p-3 text-xs text-zinc-100">
          {JSON.stringify(dryResult, null, 2)}
        </pre>
      </Modal>
    </div>
  );
}
