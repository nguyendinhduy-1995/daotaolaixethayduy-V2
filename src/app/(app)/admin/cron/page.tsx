"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, fetchMe, getToken } from "@/lib/auth-client";
import { isAdminRole } from "@/lib/admin-auth";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatDateTimeVi } from "@/lib/date-utils";

type CronResult = {
  ok: boolean;
  dryRun: boolean;
  force: boolean;
  quietHoursBlocked: boolean;
  warning?: string;
  warnings?: string[];
  counts: {
    notificationsCreated: number;
    notificationsSkipped: number;
    outboundQueued: number;
    outboundSkipped: number;
    errors: number;
  };
  breakdowns: {
    countsByPriority: { HIGH: number; MEDIUM: number; LOW: number };
    countsByOwner: Array<{ ownerId: string; ownerName: string; count: number }>;
    skippedReasons: {
      quietHours: number;
      dedupe: number;
      caps: number;
      missingOwner: number;
      missingStudent: number;
    };
  };
  preview: Array<{
    notificationId: string;
    studentName: string;
    ownerName: string;
    templateKey: string;
    priority: "HIGH" | "MEDIUM" | "LOW";
    action: "queued" | "skipped";
    reason?: string;
  }>;
};

type AutomationList = {
  items: Array<{ id: string; sentAt: string; status: string }>;
};

export default function AdminCronPage() {
  const router = useRouter();
  const [checkingRole, setCheckingRole] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [runningDry, setRunningDry] = useState(false);
  const [runningReal, setRunningReal] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CronResult | null>(null);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [force, setForce] = useState(false);

  const handleAuthError = useCallback((err: ApiClientError) => {
    if (err.code === "AUTH_MISSING_BEARER" || err.code === "AUTH_INVALID_TOKEN") {
      clearToken();
      router.replace("/login");
      return true;
    }
    return false;
  }, [router]);

  const loadLastRun = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const logs = await fetchJson<AutomationList>("/api/automation/logs?scope=daily&page=1&pageSize=1", { token });
      setLastRunAt(logs.items[0]?.sentAt ?? null);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`${err.code}: ${err.message}`);
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
    if (isAdmin) void loadLastRun();
  }, [isAdmin, loadLastRun]);

  async function runCron(dryRun: boolean) {
    const token = getToken();
    if (!token) return;
    if (dryRun) setRunningDry(true);
    else setRunningReal(true);
    setError("");
    try {
      const data = await fetchJson<CronResult>("/api/admin/cron/daily", {
        method: "POST",
        token,
        body: { dryRun, force },
      });
      setResult(data);
      await loadLastRun();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`${err.code}: ${err.message}`);
    } finally {
      if (dryRun) setRunningDry(false);
      else setRunningReal(false);
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

  const cards = [
    { label: "Thông báo tạo mới", value: result?.counts.notificationsCreated ?? 0 },
    { label: "Thông báo bỏ qua", value: result?.counts.notificationsSkipped ?? 0 },
    { label: "Tin nhắn xếp hàng", value: result?.counts.outboundQueued ?? 0 },
    { label: "Tin nhắn bỏ qua", value: result?.counts.outboundSkipped ?? 0 },
    { label: "Lỗi", value: result?.counts.errors ?? 0 },
  ];

  const priorityLabel = (priority: "HIGH" | "MEDIUM" | "LOW") => {
    if (priority === "HIGH") return "Cao";
    if (priority === "MEDIUM") return "Trung bình";
    return "Thấp";
  };

  return (
    <div className="space-y-4">
      {/* ── Premium Header ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 p-4 text-white shadow-lg shadow-red-200 animate-fadeInUp">
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/10 blur-xl" />
        <div className="relative flex flex-wrap items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-2xl backdrop-blur-sm">⏰</div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">Vận hành tự động</h2>
            <p className="text-sm text-white/80">Lần chạy gần nhất: {lastRunAt ? formatDateTimeVi(lastRunAt) : "Chưa có dữ liệu"}</p>
          </div>
        </div>
      </div>

      {error ? <Alert type="error" message={error} /> : null}
      {result ? (
        <Alert
          type={result.ok ? "success" : "error"}
          message={result.ok ? (result.quietHoursBlocked ? "Đang trong giờ yên tĩnh, tác vụ không chạy." : "Chạy cron thành công.") : "Cron có lỗi."}
        />
      ) : null}
      {result?.warning ? <Alert type="error" message={result.warning} /> : null}
      {result?.warnings?.map((w) => <Alert key={w} type="error" message={w} />)}

      <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm animate-fadeInUp" style={{ animationDelay: "80ms" }}>
        <div className="h-1 bg-gradient-to-r from-red-500 to-orange-500" />
        <div className="p-4">
          <p className="text-sm text-zinc-700">Chạy tác vụ ngày để tạo thông báo tài chính và xếp hàng gửi tin nhắc.</p>
          <label className="mt-3 flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
            Bỏ qua giờ yên tĩnh (Force)
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => runCron(true)} disabled={runningDry || runningReal}>
              {runningDry ? "Đang chạy..." : "🧪 Chạy thử (Dry run)"}
            </Button>
            <Button onClick={() => runCron(false)} disabled={runningDry || runningReal}>
              {runningReal ? "Đang chạy..." : "🚀 Chạy thật (Thực thi)"}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900">{card.value}</p>
          </div>
        ))}
      </div>

      {result ? (
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-zinc-900">Xếp hàng theo ưu tiên</p>
            <div className="mt-2 text-sm text-zinc-700">
              <p>Cao: {result.breakdowns.countsByPriority.HIGH}</p>
              <p>Trung bình: {result.breakdowns.countsByPriority.MEDIUM}</p>
              <p>Thấp: {result.breakdowns.countsByPriority.LOW}</p>
            </div>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-zinc-900">Tư vấn viên theo hàng đợi</p>
            <div className="mt-2 space-y-1 text-sm text-zinc-700">
              {result.breakdowns.countsByOwner.length === 0 ? (
                <p>Không có dữ liệu</p>
              ) : (
                result.breakdowns.countsByOwner.map((owner) => (
                  <p key={owner.ownerId}>{owner.ownerName}: {owner.count}</p>
                ))
              )}
            </div>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-zinc-900">Lý do bị bỏ qua</p>
            <div className="mt-2 text-sm text-zinc-700">
              <p>Giờ yên tĩnh: {result.breakdowns.skippedReasons.quietHours}</p>
              <p>Trùng lặp: {result.breakdowns.skippedReasons.dedupe}</p>
              <p>Vượt giới hạn: {result.breakdowns.skippedReasons.caps}</p>
              <p>Thiếu phụ trách: {result.breakdowns.skippedReasons.missingOwner}</p>
              <p>Thiếu học viên: {result.breakdowns.skippedReasons.missingStudent}</p>
            </div>
          </div>
        </div>
      ) : null}

      {result && result.preview.length > 0 ? (
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-zinc-900">Xem trước (tối đa 10 dòng)</p>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-600">
                  <th className="px-2 py-2">Học viên</th>
                  <th className="px-2 py-2">Người phụ trách</th>
                  <th className="px-2 py-2">Mẫu tin</th>
                  <th className="px-2 py-2">Ưu tiên</th>
                  <th className="px-2 py-2">Kết quả</th>
                  <th className="px-2 py-2">Lý do</th>
                </tr>
              </thead>
              <tbody>
                {result.preview.map((row) => (
                  <tr key={`${row.notificationId}-${row.templateKey}`} className="border-b border-zinc-100">
                    <td className="px-2 py-2">{row.studentName}</td>
                    <td className="px-2 py-2">{row.ownerName}</td>
                    <td className="px-2 py-2">{row.templateKey}</td>
                    <td className="px-2 py-2">{priorityLabel(row.priority)}</td>
                    <td className="px-2 py-2">{row.action === "queued" ? "Đã xếp hàng" : "Bỏ qua"}</td>
                    <td className="px-2 py-2">{row.reason || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link href="/notifications" className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700">
          Mở thông báo
        </Link>
        <Link href="/outbound" className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700">
          Mở gửi tin
        </Link>
        <Link href="/automation/logs?scope=daily" className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700">
          Mở nhật ký automation
        </Link>
      </div>
    </div>
  );
}
