"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { MobileShell } from "@/components/mobile/MobileShell";
import { clearToken, getToken } from "@/lib/auth-client";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import {
  dayOfWeekLabelVi,
  getMetricLabelVi,
  metricsForRole,
  roleLabelVi,
} from "@/lib/kpi-metrics-catalog";

type Branch = { id: string; name: string };
type UserItem = {
  id: string;
  name: string | null;
  email: string;
  role: "direct_page" | "telesales" | "manager" | "admin" | "viewer";
  branchId: string | null;
};

type TargetItem = {
  id: string;
  branchId: string;
  role: "direct_page" | "telesales";
  ownerId: string | null;
  metricKey: string;
  targetValue: number;
  dayOfWeek: number | null;
  isActive: boolean;
  metricLabelVi?: string;
  metricDescVi?: string;
  metricUnit?: string;
  owner?: { id: string; name: string | null; email: string } | null;
  branch?: { id: string; name: string };
};

type ApplyMode = "ROLE" | "USER";

function errText(error: unknown) {
  const e = error as ApiClientError;
  return `${e.code || "INTERNAL_ERROR"}: ${e.message || "Lỗi không xác định"}`;
}

function dayOfWeekApiValue(value: string) {
  if (value === "") return null;
  return Number(value);
}

export default function KpiTargetsPage() {
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [branchId, setBranchId] = useState("");
  const [role, setRole] = useState<"direct_page" | "telesales">("telesales");
  const [dayOfWeek, setDayOfWeek] = useState<string>("");
  const [targets, setTargets] = useState<TargetItem[]>([]);
  const [searchText, setSearchText] = useState("");

  const [applyMode, setApplyMode] = useState<ApplyMode>("ROLE");
  const [ownerId, setOwnerId] = useState("");
  const [metricKey, setMetricKey] = useState("appointed_rate_pct");
  const [targetValue, setTargetValue] = useState("30");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const roleMetrics = useMemo(() => metricsForRole(role), [role]);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => user.role === role && user.branchId === branchId);
  }, [users, role, branchId]);

  const filteredTargets = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return targets;
    return targets.filter((item) => {
      const ownerName = item.owner?.name || item.owner?.email || "";
      const targetText = [
        getMetricLabelVi(item.metricKey),
        roleLabelVi(item.role),
        ownerName,
        item.branch?.name || "",
        dayOfWeekLabelVi(item.dayOfWeek),
      ]
        .join(" ")
        .toLowerCase();
      return targetText.includes(q);
    });
  }, [searchText, targets]);

  const loadBranches = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    const data = await fetchJson<{ items: Branch[] }>("/api/admin/branches", { token }).catch(() => ({ items: [] }));
    setBranches(Array.isArray(data.items) ? data.items : []);
    if (!branchId && data.items?.[0]?.id) setBranchId(data.items[0].id);
  }, [branchId]);

  const loadUsers = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const data = await fetchJson<{ items: UserItem[] }>("/api/users?page=1&pageSize=200&isActive=true", { token });
      setUsers(Array.isArray(data.items) ? data.items : []);
    } catch {
      setUsers([]);
    }
  }, []);

  const loadTargets = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (branchId) params.set("branchId", branchId);
      params.set("role", role);
      if (dayOfWeek !== "") params.set("dayOfWeek", dayOfWeek);
      if (applyMode === "USER" && ownerId) params.set("ownerId", ownerId);
      params.set("activeOnly", "true");

      const data = await fetchJson<{ items: TargetItem[] }>(`/api/kpi/targets?${params.toString()}`, { token });
      setTargets(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      const err = e as ApiClientError;
      if (err.code === "AUTH_MISSING_BEARER" || err.code === "AUTH_INVALID_TOKEN") {
        clearToken();
        router.replace("/login");
        return;
      }
      setError(`Lỗi tải thiết lập mục tiêu: ${errText(e)}`);
    } finally {
      setLoading(false);
    }
  }, [applyMode, branchId, dayOfWeek, ownerId, role, router]);

  useEffect(() => {
    void loadBranches();
    void loadUsers();
  }, [loadBranches, loadUsers]);

  useEffect(() => {
    if (!roleMetrics.some((item) => item.key === metricKey)) {
      setMetricKey(roleMetrics[0]?.key || "");
    }
  }, [metricKey, roleMetrics]);

  useEffect(() => {
    if (applyMode === "ROLE") setOwnerId("");
  }, [applyMode]);

  useEffect(() => {
    if (!filteredUsers.some((user) => user.id === ownerId)) {
      setOwnerId("");
    }
  }, [filteredUsers, ownerId]);

  useEffect(() => {
    if (!branchId) return;
    void loadTargets();
  }, [branchId, role, dayOfWeek, ownerId, applyMode, loadTargets]);

  async function saveTarget() {
    const token = getToken();
    if (!token) return;
    const nextTarget = Number(targetValue || 0);
    if (!Number.isFinite(nextTarget) || nextTarget < 0 || nextTarget > 100) {
      setError("Mục tiêu phải nằm trong khoảng 0-100%");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await fetchJson("/api/kpi/targets", {
        method: "POST",
        token,
        body: {
          branchId: branchId || undefined,
          items: [
            {
              branchId: branchId || undefined,
              role,
              ownerId: applyMode === "USER" ? ownerId || null : null,
              metricKey,
              targetValue: nextTarget,
              dayOfWeek: dayOfWeekApiValue(dayOfWeek),
              isActive: true,
            },
          ],
        },
      });
      await loadTargets();
    } catch (e) {
      setError(`Lỗi lưu thiết lập: ${errText(e)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <MobileShell title="Thiết lập mục tiêu KPI" subtitle="Chỉ số phần trăm theo vai trò hoặc nhân sự">
      <div className="space-y-4 py-3">
        {error ? <Alert type="error" message={error} /> : null}

        <section className="rounded-2xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-zinc-900">Bộ lọc dữ liệu</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-4">
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
              <p className="mb-1 text-xs text-zinc-500">Vai trò</p>
              <select value={role} onChange={(e) => setRole(e.target.value as typeof role)} className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm">
                <option value="direct_page">Trực Page</option>
                <option value="telesales">Tư vấn</option>
              </select>
            </div>
            <div>
              <p className="mb-1 text-xs text-zinc-500">Ngày trong tuần</p>
              <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)} className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm">
                <option value="">Mọi ngày</option>
                <option value="1">Thứ 2</option>
                <option value="2">Thứ 3</option>
                <option value="3">Thứ 4</option>
                <option value="4">Thứ 5</option>
                <option value="5">Thứ 6</option>
                <option value="6">Thứ 7</option>
                <option value="0">Chủ nhật</option>
              </select>
            </div>
            <div>
              <p className="mb-1 text-xs text-zinc-500">Tìm nhanh</p>
              <Input placeholder="Tìm chỉ số/nhân sự..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-zinc-900">Thêm hoặc cập nhật mục tiêu</h2>

          <div className="mt-3">
            <p className="mb-1 text-xs text-zinc-500">Áp dụng cho</p>
            <div className="inline-flex rounded-xl border border-zinc-200 bg-zinc-50 p-1">
              <button
                type="button"
                onClick={() => setApplyMode("ROLE")}
                className={`rounded-lg px-3 py-1.5 text-sm ${applyMode === "ROLE" ? "bg-white text-zinc-900 shadow" : "text-zinc-600"}`}
              >
                Theo vai trò
              </button>
              <button
                type="button"
                onClick={() => setApplyMode("USER")}
                className={`rounded-lg px-3 py-1.5 text-sm ${applyMode === "USER" ? "bg-white text-zinc-900 shadow" : "text-zinc-600"}`}
              >
                Theo nhân sự
              </button>
            </div>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <div>
              <p className="mb-1 text-xs text-zinc-500">Chỉ số</p>
              <select value={metricKey} onChange={(e) => setMetricKey(e.target.value)} className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm">
                {roleMetrics.map((metric) => (
                  <option key={metric.key} value={metric.key}>
                    {metric.labelVi}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-zinc-500">{roleMetrics.find((m) => m.key === metricKey)?.descVi || ""}</p>
            </div>

            {applyMode === "USER" ? (
              <div>
                <p className="mb-1 text-xs text-zinc-500">Nhân sự</p>
                <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm">
                  <option value="">Chọn nhân sự</option>
                  {filteredUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name || user.email}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <p className="mb-1 text-xs text-zinc-500">Phạm vi áp dụng</p>
                <p className="h-10 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">Cả vai trò</p>
              </div>
            )}

            <div>
              <p className="mb-1 text-xs text-zinc-500">Mục tiêu</p>
              <Input type="number" min={0} max={100} placeholder="vd: 30" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />
              <p className="mt-1 text-xs text-zinc-500">Nhập phần trăm, ví dụ 30 nghĩa là 30%</p>
            </div>

            <div className="flex items-end">
              <Button onClick={saveTarget} disabled={saving || !metricKey || (applyMode === "USER" && !ownerId)}>
                {saving ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner /> Đang lưu...
                  </span>
                ) : (
                  "Lưu mục tiêu"
                )}
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-zinc-900">Danh sách mục tiêu hiện tại</h2>

          {loading ? (
            <p className="mt-3 text-sm text-zinc-600">Đang tải dữ liệu...</p>
          ) : filteredTargets.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600">Chưa có mục tiêu phù hợp bộ lọc.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {filteredTargets.map((item) => (
                <div key={item.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-sm font-semibold text-zinc-900">{item.metricLabelVi || getMetricLabelVi(item.metricKey)}</p>
                  <p className="text-sm text-zinc-700">
                    Vai trò: {roleLabelVi(item.role)} • Mục tiêu: {item.targetValue.toLocaleString("vi-VN")}%
                  </p>
                  <p className="text-sm text-zinc-700">
                    Áp dụng: {item.ownerId ? `Nhân sự: ${item.owner?.name || item.owner?.email || "Không xác định"}` : "Cả vai trò"}
                  </p>
                  <p className="text-sm text-zinc-700">Ngày trong tuần: {dayOfWeekLabelVi(item.dayOfWeek)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </MobileShell>
  );
}
