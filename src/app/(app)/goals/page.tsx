"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { MobileShell } from "@/components/mobile/MobileShell";
import { clearToken, getToken } from "@/lib/auth-client";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { todayInHoChiMinh } from "@/lib/date-utils";

type Branch = { id: string; name: string };
type GoalItem = {
  id: string;
  branchId: string | null;
  periodType: "DAILY" | "MONTHLY";
  dateKey: string | null;
  monthKey: string | null;
  revenueTarget: number;
  dossierTarget: number;
  costTarget: number;
  note: string | null;
  branch?: { id: string; name: string } | null;
};

function errText(error: unknown) {
  const e = error as ApiClientError;
  return `${e.code || "INTERNAL_ERROR"}: ${e.message || "Lỗi không xác định"}`;
}

export default function GoalsPage() {
  const router = useRouter();
  const today = todayInHoChiMinh();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [periodType, setPeriodType] = useState<"DAILY" | "MONTHLY">("DAILY");
  const [dateKey, setDateKey] = useState(today);
  const [monthKey, setMonthKey] = useState(today.slice(0, 7));
  const [branchId, setBranchId] = useState("");
  const [revenueTarget, setRevenueTarget] = useState("0");
  const [dossierTarget, setDossierTarget] = useState("0");
  const [costTarget, setCostTarget] = useState("0");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<GoalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadBranches = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    const data = await fetchJson<{ items: Branch[] }>("/api/admin/branches", { token }).catch(() => ({ items: [] }));
    setBranches(Array.isArray(data.items) ? data.items : []);
    if (!branchId && data.items?.[0]?.id) setBranchId(data.items[0].id);
  }, [branchId]);

  const loadGoals = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ periodType });
      if (periodType === "DAILY") params.set("dateKey", dateKey);
      if (periodType === "MONTHLY") params.set("monthKey", monthKey);
      if (branchId) params.set("branchId", branchId);
      const data = await fetchJson<{ items: GoalItem[] }>(`/api/goals?${params.toString()}`, { token });
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      const err = e as ApiClientError;
      if (err.code === "AUTH_MISSING_BEARER" || err.code === "AUTH_INVALID_TOKEN") {
        clearToken();
        router.replace("/login");
        return;
      }
      setError(`Lỗi tải mục tiêu: ${errText(e)}`);
    } finally {
      setLoading(false);
    }
  }, [branchId, dateKey, monthKey, periodType, router]);

  useEffect(() => {
    loadBranches().then(() => loadGoals());
  }, [loadBranches, loadGoals]);

  async function saveGoal() {
    const token = getToken();
    if (!token) return;
    setSaving(true);
    setError("");
    try {
      await fetchJson("/api/goals", {
        method: "POST",
        token,
        body: {
          periodType,
          branchId: branchId || null,
          dateKey: periodType === "DAILY" ? dateKey : undefined,
          monthKey: periodType === "MONTHLY" ? monthKey : undefined,
          revenueTarget: Number(revenueTarget || 0),
          dossierTarget: Number(dossierTarget || 0),
          costTarget: Number(costTarget || 0),
          note,
        },
      });
      await loadGoals();
    } catch (e) {
      setError(`Lỗi lưu mục tiêu: ${errText(e)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <MobileShell title="Mục tiêu ngày/tháng" subtitle="Thiết lập doanh thu, hồ sơ, chi phí">
      <div className="space-y-4 py-3">
        {error ? <Alert type="error" message={error} /> : null}

        <section className="rounded-2xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-zinc-900">Thiết lập mục tiêu</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div>
              <p className="mb-1 text-xs text-zinc-500">Kỳ mục tiêu</p>
              <select value={periodType} onChange={(e) => setPeriodType(e.target.value as "DAILY" | "MONTHLY")} className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm">
                <option value="DAILY">Ngày</option>
                <option value="MONTHLY">Tháng</option>
              </select>
            </div>
            <div>
              <p className="mb-1 text-xs text-zinc-500">Chi nhánh</p>
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm">
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="mb-1 text-xs text-zinc-500">Ngày/Tháng</p>
              {periodType === "DAILY" ? (
                <Input type="date" value={dateKey} onChange={(e) => setDateKey(e.target.value)} />
              ) : (
                <Input type="month" value={monthKey} onChange={(e) => setMonthKey(e.target.value)} />
              )}
            </div>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div>
              <p className="mb-1 text-xs text-zinc-500">Mục tiêu doanh thu</p>
              <Input type="number" value={revenueTarget} onChange={(e) => setRevenueTarget(e.target.value)} />
            </div>
            <div>
              <p className="mb-1 text-xs text-zinc-500">Mục tiêu hồ sơ</p>
              <Input type="number" value={dossierTarget} onChange={(e) => setDossierTarget(e.target.value)} />
            </div>
            <div>
              <p className="mb-1 text-xs text-zinc-500">Mục tiêu chi phí</p>
              <Input type="number" value={costTarget} onChange={(e) => setCostTarget(e.target.value)} />
            </div>
          </div>

          <div className="mt-3">
            <p className="mb-1 text-xs text-zinc-500">Ghi chú</p>
            <textarea
              className="min-h-24 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ghi chú mục tiêu"
            />
          </div>

          <div className="mt-3 flex gap-2">
            <Button onClick={saveGoal} disabled={saving}>
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner /> Đang lưu...
                </span>
              ) : (
                "Lưu mục tiêu"
              )}
            </Button>
            <Button variant="secondary" onClick={loadGoals} disabled={loading}>
              Làm mới
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-zinc-900">Mục tiêu đã lưu</h2>
          {loading ? (
            <p className="mt-3 text-sm text-zinc-600">Đang tải dữ liệu...</p>
          ) : items.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600">Chưa có mục tiêu cho bộ lọc hiện tại.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {items.map((item) => (
                <div key={item.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-sm font-semibold text-zinc-900">{item.branch?.name || "Toàn hệ thống"}</p>
                  <p className="text-sm text-zinc-700">
                    {item.periodType === "DAILY" ? `Ngày ${item.dateKey}` : `Tháng ${item.monthKey}`}
                  </p>
                  <p className="text-sm text-zinc-700">
                    Doanh thu: {item.revenueTarget.toLocaleString("vi-VN")} • Hồ sơ: {item.dossierTarget} • Chi phí: {item.costTarget.toLocaleString("vi-VN")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </MobileShell>
  );
}
