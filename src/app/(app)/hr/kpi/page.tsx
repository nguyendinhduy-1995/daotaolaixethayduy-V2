"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, fetchMe, getToken } from "@/lib/auth-client";
import { isAdminRole } from "@/lib/admin-auth";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilterCard } from "@/components/ui/filter-card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table } from "@/components/ui/table";
import { DataCard } from "@/components/mobile/DataCard";
import { formatDateVi } from "@/lib/date-utils";

type Role = "PAGE" | "TELESALES";

type UserOption = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isActive: boolean;
};

type EmployeeKpiSetting = {
  id: string;
  userId: string;
  role: Role;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  targetsJson: Record<string, number>;
  createdAt: string;
  updatedAt: string;
  user: UserOption;
};

type ListResponse = {
  items: EmployeeKpiSetting[];
  page: number;
  pageSize: number;
  total: number;
};

type UsersResponse = {
  items: UserOption[];
};

type FormState = {
  userId: string;
  role: Role;
  effectiveFrom: string;
  effectiveTo: string;
  isActive: boolean;
  dataRatePctTarget: string;
  data: string;
  called: string;
  appointed: string;
  arrived: string;
  signed: string;
  calledPctGlobal: string;
  appointedPctGlobal: string;
  arrivedPctGlobal: string;
  signedPctGlobal: string;
};

const DEFAULT_FORM: FormState = {
  userId: "",
  role: "TELESALES",
  effectiveFrom: new Date().toISOString().slice(0, 10),
  effectiveTo: "",
  isActive: true,
  dataRatePctTarget: "20",
  data: "4",
  called: "0",
  appointed: "4",
  arrived: "0",
  signed: "0",
  calledPctGlobal: "100",
  appointedPctGlobal: "80",
  arrivedPctGlobal: "80",
  signedPctGlobal: "100",
};

function parseApiError(err: ApiClientError) {
  return `${err.code}: ${err.message}`;
}

function statusBadge(active: boolean) {
  return active ? <Badge text="Đang áp dụng" tone="success" /> : <Badge text="Ngưng áp dụng" tone="neutral" />;
}

function roleLabel(role: Role) {
  return role === "PAGE" ? "Trực Page" : "Telesales";
}

function summarizeTargets(role: Role, targets: Record<string, number>) {
  if (role === "PAGE") {
    const target = Number(targets.dataRatePctTarget ?? 0).toFixed(1);
    return `Mục tiêu % ra Data: ${target}% (Data / Tin nhắn × 100)`;
  }
  const abs = `Data: ${targets.dataDaily ?? targets.data ?? 0} • Gọi: ${targets.calledDaily ?? targets.called ?? 0} • Hẹn: ${targets.appointedDaily ?? targets.appointed ?? 0} • Đến: ${targets.arrivedDaily ?? targets.arrived ?? 0} • Ký: ${targets.signedDaily ?? targets.signed ?? 0}`;
  const pct = `Gọi ${targets.calledPctGlobal ?? 0}% • Hẹn ${targets.appointedPctGlobal ?? 0}% • Đến ${targets.arrivedPctGlobal ?? 0}% • Ký ${targets.signedPctGlobal ?? 0}% (MTD)`;
  return `${abs} • ${pct}`;
}

function toNumber(value: string) {
  if (value.trim() === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

export default function EmployeeKpiPage() {
  const router = useRouter();
  const [checkingRole, setCheckingRole] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [items, setItems] = useState<EmployeeKpiSetting[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const [filterRole, setFilterRole] = useState<"" | Role>("");
  const [filterUserId, setFilterUserId] = useState("");
  const [filterActive, setFilterActive] = useState<"" | "true" | "false">("");

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EmployeeKpiSetting | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

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

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (filterRole) params.set("role", filterRole);
    if (filterUserId) params.set("userId", filterUserId);
    if (filterActive) params.set("active", filterActive);
    return params.toString();
  }, [filterActive, filterRole, filterUserId, page, pageSize]);

  const loadData = useCallback(async () => {
    const token = getToken();
    if (!token || !isAdmin) return;
    setLoading(true);
    setError("");
    try {
      const [settingsRes, usersRes] = await Promise.all([
        fetchJson<ListResponse>(`/api/admin/employee-kpi?${query}`, { token }),
        fetchJson<UsersResponse>("/api/users?isActive=true&page=1&pageSize=200", { token }),
      ]);
      setItems(settingsRes.items);
      setPage(settingsRes.page);
      setPageSize(settingsRes.pageSize);
      setTotal(settingsRes.total);
      setUsers(usersRes.items.filter((item) => item.role === "telesales" || item.role === "direct_page" || item.role === "admin"));
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, [handleAuthError, isAdmin, query]);

  useEffect(() => {
    if (isAdmin) void loadData();
  }, [isAdmin, loadData]);

  function openCreateModal() {
    setEditTarget(null);
    setForm((current) => ({
      ...DEFAULT_FORM,
      userId: users[0]?.id ?? current.userId,
    }));
    setModalOpen(true);
  }

  function openEditModal(setting: EmployeeKpiSetting) {
    setEditTarget(setting);
    setForm({
      userId: setting.userId,
      role: setting.role,
      effectiveFrom: setting.effectiveFrom.slice(0, 10),
      effectiveTo: setting.effectiveTo ? setting.effectiveTo.slice(0, 10) : "",
      isActive: setting.isActive,
      dataRatePctTarget: String(setting.targetsJson.dataRatePctTarget ?? 20),
      data: String(setting.targetsJson.dataDaily ?? setting.targetsJson.data ?? 4),
      called: String(setting.targetsJson.calledDaily ?? setting.targetsJson.called ?? 0),
      appointed: String(setting.targetsJson.appointedDaily ?? setting.targetsJson.appointed ?? 4),
      arrived: String(setting.targetsJson.arrivedDaily ?? setting.targetsJson.arrived ?? 0),
      signed: String(setting.targetsJson.signedDaily ?? setting.targetsJson.signed ?? 0),
      calledPctGlobal: String(setting.targetsJson.calledPctGlobal ?? 100),
      appointedPctGlobal: String(setting.targetsJson.appointedPctGlobal ?? 80),
      arrivedPctGlobal: String(setting.targetsJson.arrivedPctGlobal ?? 80),
      signedPctGlobal: String(setting.targetsJson.signedPctGlobal ?? 100),
    });
    setModalOpen(true);
  }

  async function submitForm() {
    const token = getToken();
    if (!token) return;

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      if (!form.userId) {
        setError("VALIDATION_ERROR: Vui lòng chọn nhân viên.");
        return;
      }

      let targetsJson: Record<string, number>;
      if (form.role === "PAGE") {
        const dataRatePctTarget = toNumber(form.dataRatePctTarget);
        if (dataRatePctTarget === undefined || dataRatePctTarget < 0 || dataRatePctTarget > 100) {
          setError("VALIDATION_ERROR: Mục tiêu % ra Data phải từ 0 đến 100.");
          return;
        }
        targetsJson = {
          dataRatePctTarget: Math.round(dataRatePctTarget * 10) / 10,
        };
      } else {
        targetsJson = {};
        const entries: Array<[string, number | undefined]> = [
          ["dataDaily", toNumber(form.data)],
          ["calledDaily", toNumber(form.called)],
          ["appointedDaily", toNumber(form.appointed)],
          ["arrivedDaily", toNumber(form.arrived)],
          ["signedDaily", toNumber(form.signed)],
          ["calledPctGlobal", toNumber(form.calledPctGlobal)],
          ["appointedPctGlobal", toNumber(form.appointedPctGlobal)],
          ["arrivedPctGlobal", toNumber(form.arrivedPctGlobal)],
          ["signedPctGlobal", toNumber(form.signedPctGlobal)],
        ];
        for (const [key, value] of entries) {
          if (value !== undefined) targetsJson[key] = value;
        }
        if (Object.keys(targetsJson).length === 0) {
          setError("VALIDATION_ERROR: Telesales cần ít nhất 1 chỉ tiêu.");
          return;
        }
      }

      const body = {
        userId: form.userId,
        role: form.role,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
        isActive: form.isActive,
        targetsJson,
      };

      if (editTarget) {
        await fetchJson<{ setting: EmployeeKpiSetting }>(`/api/admin/employee-kpi/${editTarget.id}`, {
          method: "PATCH",
          token,
          body,
        });
        setSuccess("Đã cập nhật KPI nhân sự.");
      } else {
        await fetchJson<{ setting: EmployeeKpiSetting }>("/api/admin/employee-kpi", {
          method: "POST",
          token,
          body,
        });
        setSuccess("Đã tạo KPI nhân sự.");
      }

      setModalOpen(false);
      await loadData();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(parseApiError(err));
    } finally {
      setSubmitting(false);
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
    return <Alert type="error" message="Bạn không có quyền truy cập." />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="KPI nhân sự"
        subtitle="Thiết lập KPI theo nhân viên và thời gian hiệu lực"
        actions={
          <>
            <Button variant="secondary" onClick={() => void loadData()} disabled={loading}>
              {loading ? "Đang tải..." : "Làm mới"}
            </Button>
            <Button onClick={openCreateModal}>Tạo KPI</Button>
          </>
        }
      />

      {error ? <Alert type="error" message={error} /> : null}
      {success ? <Alert type="success" message={success} /> : null}

      <FilterCard title="Bộ lọc">
        <div className="grid gap-3 md:grid-cols-5">
          <label className="space-y-1 text-sm text-zinc-700">
            <span>Nhân viên</span>
            <Select value={filterUserId} onChange={(e) => setFilterUserId(e.target.value)}>
              <option value="">Tất cả</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name || user.email}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1 text-sm text-zinc-700">
            <span>Vai trò KPI</span>
            <Select value={filterRole} onChange={(e) => setFilterRole(e.target.value as "" | Role)}>
              <option value="">Tất cả</option>
              <option value="PAGE">Trực Page</option>
              <option value="TELESALES">Telesales</option>
            </Select>
          </label>
          <label className="space-y-1 text-sm text-zinc-700">
            <span>Trạng thái</span>
            <Select value={filterActive} onChange={(e) => setFilterActive(e.target.value as "" | "true" | "false") }>
              <option value="">Tất cả</option>
              <option value="true">Đang áp dụng</option>
              <option value="false">Ngưng áp dụng</option>
            </Select>
          </label>
          <label className="space-y-1 text-sm text-zinc-700">
            <span>Kích thước trang</span>
            <Select
              value={String(pageSize)}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </Select>
          </label>
          <div className="flex items-end">
            <Button
              onClick={() => {
                setPage(1);
                void loadData();
              }}
            >
              Áp dụng
            </Button>
          </div>
        </div>
      </FilterCard>

      {loading ? (
        <div className="flex items-center gap-2 text-zinc-700">
          <Spinner /> Đang tải dữ liệu KPI nhân sự...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">Không có dữ liệu KPI nhân sự.</div>
      ) : (
        <>
          <div className="hidden md:block">
            <Table headers={["Nhân viên", "Vai trò KPI", "Chỉ tiêu", "Hiệu lực", "Trạng thái", "Hành động"]}>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-900">{item.user.name || item.user.email}</div>
                    <div className="text-xs text-zinc-500">{item.user.email}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{roleLabel(item.role)}</td>
                  <td className="px-4 py-3 text-zinc-700">{summarizeTargets(item.role, item.targetsJson)}</td>
                  <td className="px-4 py-3 text-zinc-700">
                    {formatDateVi(item.effectiveFrom)} - {item.effectiveTo ? formatDateVi(item.effectiveTo) : "Không giới hạn"}
                  </td>
                  <td className="px-4 py-3">{statusBadge(item.isActive)}</td>
                  <td className="px-4 py-3">
                    <Button variant="secondary" onClick={() => openEditModal(item)}>
                      Sửa
                    </Button>
                  </td>
                </tr>
              ))}
            </Table>
          </div>

          <div className="space-y-2 md:hidden">
            {items.map((item) => (
              <DataCard
                key={item.id}
                title={item.user.name || item.user.email}
                subtitle={`${roleLabel(item.role)} • ${formatDateVi(item.effectiveFrom)}`}
                badge={statusBadge(item.isActive)}
                footer={
                  <Button variant="secondary" onClick={() => openEditModal(item)}>
                    Sửa
                  </Button>
                }
              >
                <div className="space-y-1 text-xs">
                  <p>{summarizeTargets(item.role, item.targetsJson)}</p>
                  <p className="text-zinc-500">Hiệu lực đến: {item.effectiveTo ? formatDateVi(item.effectiveTo) : "Không giới hạn"}</p>
                </div>
              </DataCard>
            ))}
          </div>

          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={(next) => {
              setPage(next);
            }}
          />
        </>
      )}

      <Modal
        open={modalOpen}
        title={editTarget ? "Cập nhật KPI nhân sự" : "Tạo KPI nhân sự"}
        description="Thiết lập KPI theo vai trò và khoảng thời gian hiệu lực"
        onClose={() => setModalOpen(false)}
      >
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm text-zinc-700">
              <span>Nhân viên</span>
              <Select value={form.userId} onChange={(e) => setForm((prev) => ({ ...prev, userId: e.target.value }))}>
                <option value="">Chọn nhân viên</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email}
                  </option>
                ))}
              </Select>
            </label>

            <label className="space-y-1 text-sm text-zinc-700">
              <span>Vai trò KPI</span>
              <Select value={form.role} onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value as Role }))}>
                <option value="PAGE">Trực Page</option>
                <option value="TELESALES">Telesales</option>
              </Select>
            </label>

            <label className="space-y-1 text-sm text-zinc-700">
              <span>Hiệu lực từ ngày</span>
              <Input type="date" value={form.effectiveFrom} onChange={(e) => setForm((prev) => ({ ...prev, effectiveFrom: e.target.value }))} />
            </label>

            <label className="space-y-1 text-sm text-zinc-700">
              <span>Hiệu lực đến ngày</span>
              <Input type="date" value={form.effectiveTo} onChange={(e) => setForm((prev) => ({ ...prev, effectiveTo: e.target.value }))} />
            </label>

            <label className="flex items-center gap-2 text-sm text-zinc-700 md:col-span-2">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              />
              Đang áp dụng
            </label>
          </div>

          {form.role === "PAGE" ? (
            <div className="space-y-3">
              <label className="space-y-1 text-sm text-zinc-700">
                <span>Mục tiêu % ra Data</span>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  placeholder="20"
                  value={form.dataRatePctTarget}
                  onChange={(e) => setForm((prev) => ({ ...prev, dataRatePctTarget: e.target.value }))}
                />
              </label>
              <p className="text-xs text-zinc-500">% = Data / Tin nhắn × 100</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1 text-sm text-zinc-700">
                <span>Data</span>
                <Input value={form.data} onChange={(e) => setForm((prev) => ({ ...prev, data: e.target.value }))} />
              </label>
              <label className="space-y-1 text-sm text-zinc-700">
                <span>Đã gọi</span>
                <Input value={form.called} onChange={(e) => setForm((prev) => ({ ...prev, called: e.target.value }))} />
              </label>
              <label className="space-y-1 text-sm text-zinc-700">
                <span>Đã hẹn</span>
                <Input value={form.appointed} onChange={(e) => setForm((prev) => ({ ...prev, appointed: e.target.value }))} />
              </label>
              <label className="space-y-1 text-sm text-zinc-700">
                <span>Đã đến</span>
                <Input value={form.arrived} onChange={(e) => setForm((prev) => ({ ...prev, arrived: e.target.value }))} />
              </label>
              <label className="space-y-1 text-sm text-zinc-700">
                <span>Đã ký</span>
                <Input value={form.signed} onChange={(e) => setForm((prev) => ({ ...prev, signed: e.target.value }))} />
              </label>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-sm font-medium text-zinc-800">KPI % theo Data (tháng)</p>
                <p className="mt-1 text-xs text-zinc-500">Tính từ ngày 01 đến hiện tại (MTD), tự reset đầu tháng.</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="space-y-1 text-sm text-zinc-700">
                    <span>Gọi (% trên Data tháng)</span>
                    <Input
                      value={form.calledPctGlobal}
                      onChange={(e) => setForm((prev) => ({ ...prev, calledPctGlobal: e.target.value }))}
                    />
                  </label>
                  <label className="space-y-1 text-sm text-zinc-700">
                    <span>Hẹn (% trên Data tháng)</span>
                    <Input
                      value={form.appointedPctGlobal}
                      onChange={(e) => setForm((prev) => ({ ...prev, appointedPctGlobal: e.target.value }))}
                    />
                  </label>
                  <label className="space-y-1 text-sm text-zinc-700">
                    <span>Đến (% trên Data tháng)</span>
                    <Input
                      value={form.arrivedPctGlobal}
                      onChange={(e) => setForm((prev) => ({ ...prev, arrivedPctGlobal: e.target.value }))}
                    />
                  </label>
                  <label className="space-y-1 text-sm text-zinc-700">
                    <span>Ký (% trên Data tháng)</span>
                    <Input
                      value={form.signedPctGlobal}
                      onChange={(e) => setForm((prev) => ({ ...prev, signedPctGlobal: e.target.value }))}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Hủy
            </Button>
            <Button onClick={() => void submitForm()} disabled={submitting}>
              {submitting ? "Đang lưu..." : "Lưu"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
