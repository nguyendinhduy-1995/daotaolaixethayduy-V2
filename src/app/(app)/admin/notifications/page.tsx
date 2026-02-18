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

type GenerateResult = {
  scope: string;
  dryRun: boolean;
  created: number;
  preview: Array<{ id?: string; title: string; message: string; priority: string; studentId?: string }>;
};

export default function AdminNotificationsPage() {
  const router = useRouter();
  const [checkingRole, setCheckingRole] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingDry, setLoadingDry] = useState(false);
  const [loadingReal, setLoadingReal] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GenerateResult | null>(null);

  const handleAuthError = useCallback((err: ApiClientError) => {
    if (err.code === "AUTH_MISSING_BEARER" || err.code === "AUTH_INVALID_TOKEN") {
      clearToken();
      router.replace("/login");
      return true;
    }
    return false;
  }, [router]);

  useEffect(() => {
    fetchMe()
      .then((data) => setIsAdmin(isAdminRole(data.user.role)))
      .catch(() => {
        clearToken();
        router.replace("/login");
      })
      .finally(() => setCheckingRole(false));
  }, [router]);

  async function runGenerate(dryRun: boolean) {
    const token = getToken();
    if (!token) return;
    if (dryRun) setLoadingDry(true);
    if (!dryRun) setLoadingReal(true);
    setError("");
    try {
      const data = await fetchJson<GenerateResult>("/api/notifications/generate", {
        method: "POST",
        token,
        body: { scope: "finance", dryRun },
      });
      setResult(data);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`${err.code}: ${err.message}`);
    } finally {
      if (dryRun) setLoadingDry(false);
      if (!dryRun) setLoadingReal(false);
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
        <Link href="/notifications" className="inline-block rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700">
          Quay về thông báo
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Premium Header ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500 p-4 text-white shadow-lg shadow-yellow-200 animate-fadeInUp">
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/10 blur-xl" />
        <div className="relative flex flex-wrap items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-2xl backdrop-blur-sm">🔔</div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">Quản trị thông báo</h2>
            <p className="text-sm text-white/80">Sinh thông báo tài chính và quản lý hàng đợi</p>
          </div>
          <Link href="/notifications?scope=FINANCE" className="rounded-lg bg-white/20 px-3 py-2 text-sm text-white backdrop-blur-sm hover:bg-white/30 transition">
            📊 Mở danh sách tài chính
          </Link>
        </div>
      </div>

      {error ? <Alert type="error" message={error} /> : null}

      <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm animate-fadeInUp" style={{ animationDelay: "80ms" }}>
        <div className="h-1 bg-gradient-to-r from-yellow-500 to-amber-500" />
        <div className="p-4">
          <p className="text-sm text-zinc-700">Sinh hàng đợi thông báo thu học phí theo rule tài chính.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => runGenerate(true)} disabled={loadingDry || loadingReal}>
              {loadingDry ? "Đang chạy..." : "🧪 Xem trước hôm nay"}
            </Button>
            <Button onClick={() => runGenerate(false)} disabled={loadingDry || loadingReal}>
              {loadingReal ? "Đang chạy..." : "🚀 Tạo thông báo hôm nay"}
            </Button>
          </div>
        </div>
      </div>

      {result ? (
        <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm animate-fadeInUp" style={{ animationDelay: "160ms" }}>
          <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
          <div className="p-4">
            <p className="text-sm text-zinc-700">
              Kết quả: loại <span className="font-semibold">{result.scope === "finance" ? "tài chính" : result.scope}</span> • {result.dryRun ? "xem trước" : "ghi dữ liệu"} • tạo{" "}
              <span className="font-semibold">{result.created}</span>
            </p>
            <div className="mt-2 space-y-2">
              {result.preview.slice(0, 10).map((item, idx) => (
                <div key={`${item.studentId || "row"}-${idx}`} className="rounded-lg border border-zinc-200 p-2 text-sm text-zinc-700">
                  <p className="font-medium text-zinc-900">{item.title}</p>
                  <p>{item.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
