"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, fetchMe, getToken } from "@/lib/auth-client";
import { isAdminRole } from "@/lib/admin-auth";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Table } from "@/components/ui/table";
import { formatDateTimeVi } from "@/lib/date-utils";

type WorkerResult = {
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
};

type OutboundFail = {
  id: string;
  templateKey: string;
  error: string | null;
  retryCount: number;
  createdAt: string;
  leadId: string | null;
  studentId: string | null;
};

type OutboundList = { items: OutboundFail[] };

function formatApiError(err: ApiClientError) {
  return `${err.code}: ${err.message}`;
}

export default function AdminWorkerPage() {
  const router = useRouter();
  const [checkingRole, setCheckingRole] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [result, setResult] = useState<WorkerResult | null>(null);
  const [batchSize, setBatchSize] = useState(50);
  const [concurrency, setConcurrency] = useState(5);
  const [force, setForce] = useState(false);
  const [failedItems, setFailedItems] = useState<OutboundFail[]>([]);
  const [detail, setDetail] = useState<OutboundFail | null>(null);

  const cards = useMemo(
    () => [
      { label: "Đã xử lý", value: result?.processed ?? 0 },
      { label: "Đã gửi", value: result?.sent ?? 0 },
      { label: "Thất bại", value: result?.failed ?? 0 },
      { label: "Giới hạn tốc độ", value: result?.rateLimited ?? 0 },
    ],
    [result]
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

  const loadFailures = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const data = await fetchJson<OutboundList>("/api/outbound/messages?status=FAILED&page=1&pageSize=20", { token });
      setFailedItems(data.items);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(formatApiError(err));
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
    if (isAdmin) void loadFailures();
  }, [isAdmin, loadFailures]);

  async function runWorker(opts: { dryRun: boolean; retryFailedOnly?: boolean }) {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const data = await fetchJson<WorkerResult>("/api/admin/worker/outbound", {
        method: "POST",
        token,
        body: {
          dryRun: opts.dryRun,
          retryFailedOnly: Boolean(opts.retryFailedOnly),
          batchSize,
          concurrency,
          force,
        },
      });
      setResult(data);
      setSuccess("Worker chạy thành công.");
      await loadFailures();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }

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
        <h1 className="text-xl font-semibold text-zinc-900">Worker gửi tin</h1>
        <Button variant="secondary" onClick={loadFailures} disabled={loading}>
          Làm mới
        </Button>
      </div>

      {error ? <Alert type="error" message={error} /> : null}
      {success ? <Alert type="success" message={success} /> : null}

      <div className="grid gap-2 rounded-xl bg-white p-4 shadow-sm md:grid-cols-3">
        <label className="space-y-1 text-sm text-zinc-700">
          <span>Kích thước lô</span>
          <Input type="number" min={1} max={200} value={batchSize} onChange={(e) => setBatchSize(Number(e.target.value) || 1)} />
        </label>
        <label className="space-y-1 text-sm text-zinc-700">
          <span>Concurrency</span>
          <Input type="number" min={1} max={20} value={concurrency} onChange={(e) => setConcurrency(Number(e.target.value) || 1)} />
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm text-zinc-700">
          <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
          Bỏ qua kiểm tra thời điểm (Force)
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => runWorker({ dryRun: true })} disabled={loading}>
          Chạy thử
        </Button>
        <Button onClick={() => runWorker({ dryRun: false })} disabled={loading}>
          Chạy thật
        </Button>
        <Button variant="secondary" onClick={() => runWorker({ dryRun: false, retryFailedOnly: true })} disabled={loading}>
          Chỉ gửi lại lỗi
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900">{card.value}</p>
          </div>
        ))}
      </div>

      {result ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-zinc-900">Theo ưu tiên</p>
            <p className="mt-2 text-sm text-zinc-700">Cao: {result.breakdownByPriority.HIGH}</p>
            <p className="text-sm text-zinc-700">Trung bình: {result.breakdownByPriority.MEDIUM}</p>
            <p className="text-sm text-zinc-700">Thấp: {result.breakdownByPriority.LOW}</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-zinc-900">Theo telesales</p>
            <div className="mt-2 space-y-1 text-sm text-zinc-700">
              {result.breakdownByOwner.length === 0 ? <p>Không có dữ liệu</p> : result.breakdownByOwner.map((o) => <p key={o.ownerId}>{o.ownerName}: {o.count}</p>)}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link href="/outbound?status=QUEUED" className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700">
          Hàng chờ
        </Link>
        <Link href="/outbound?status=FAILED" className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700">
          Tin lỗi
        </Link>
        <Link href="/automation/logs?scope=outbound-worker" className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700">
          Nhật ký worker
        </Link>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <p className="text-sm font-medium text-zinc-900">Lỗi gần đây (20 bản ghi)</p>
        {failedItems.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">Không có dữ liệu.</p>
        ) : (
          <Table headers={["Thời gian", "Template", "Lỗi", "Số lần thử", "Hành động"]}>
            {failedItems.map((row) => (
              <tr key={row.id} className="border-t border-zinc-100">
                <td className="px-3 py-2 text-sm text-zinc-700">{formatDateTimeVi(row.createdAt)}</td>
                <td className="px-3 py-2 text-sm text-zinc-700">{row.templateKey}</td>
                <td className="px-3 py-2 text-sm text-red-700">{row.error || "-"}</td>
                <td className="px-3 py-2 text-sm text-zinc-700">{row.retryCount}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <Button variant="secondary" className="h-7 px-2 py-1 text-xs" onClick={() => setDetail(row)}>
                      Xem JSON
                    </Button>
                    <Link href="/outbound" className="rounded-lg border border-zinc-300 px-2 py-1 text-xs text-zinc-700">
                      Mở
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>

      <Modal open={Boolean(detail)} title="Chi tiết lỗi worker" onClose={() => setDetail(null)}>
        <pre className="max-h-[420px] overflow-auto rounded-lg bg-zinc-900 p-3 text-xs text-zinc-100">
          {JSON.stringify(detail, null, 2)}
        </pre>
      </Modal>
    </div>
  );
}
