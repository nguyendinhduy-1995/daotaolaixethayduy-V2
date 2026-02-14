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
  notificationsCreated: number;
  notificationsSkipped: number;
  outboundQueued: number;
  outboundSkipped: number;
  errors: number;
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
        body: { dryRun },
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
    { label: "Thông báo tạo mới", value: result?.notificationsCreated ?? 0 },
    { label: "Thông báo bỏ qua", value: result?.notificationsSkipped ?? 0 },
    { label: "Tin nhắn xếp hàng", value: result?.outboundQueued ?? 0 },
    { label: "Tin nhắn bỏ qua", value: result?.outboundSkipped ?? 0 },
    { label: "Lỗi", value: result?.errors ?? 0 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-900">Vận hành tự động</h1>
        <p className="text-sm text-zinc-600">
          Lần chạy gần nhất: {lastRunAt ? formatDateTimeVi(lastRunAt) : "Chưa có dữ liệu"}
        </p>
      </div>

      {error ? <Alert type="error" message={error} /> : null}
      {result ? <Alert type={result.ok ? "success" : "error"} message={result.ok ? "Chạy cron thành công." : "Cron có lỗi."} /> : null}

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <p className="text-sm text-zinc-700">Chạy tác vụ ngày để tạo thông báo tài chính và xếp hàng gửi tin nhắc.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => runCron(true)} disabled={runningDry || runningReal}>
            {runningDry ? "Đang chạy..." : "Chạy thử (Dry run)"}
          </Button>
          <Button onClick={() => runCron(false)} disabled={runningDry || runningReal}>
            {runningReal ? "Đang chạy..." : "Chạy thật (Thực thi)"}
          </Button>
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
