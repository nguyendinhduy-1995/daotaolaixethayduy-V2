"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, fetchMe, getToken } from "@/lib/auth-client";
import { isAdminRole } from "@/lib/admin-auth";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FilterCard } from "@/components/ui/filter-card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table } from "@/components/ui/table";
import { formatCurrencyVnd, formatDateTimeVi } from "@/lib/date-utils";

type Branch = { id: string; name: string };

type PayrollItem = {
  id: string;
  userId: string;
  baseSalaryVnd: number;
  allowanceVnd: number;
  daysWorked: number;
  standardDays: number;
  baseProratedVnd: number;
  commissionVnd: number;
  penaltyVnd: number;
  bonusVnd: number;
  totalVnd: number;
  breakdownJson: unknown;
  user?: { id: string; name: string | null; email: string };
};

type PayrollRun = {
  id: string;
  month: string;
  branchId: string;
  status: "DRAFT" | "FINAL" | "PAID";
  generatedAt: string | null;
  items: PayrollItem[];
  branch: Branch;
};

type DryRunResult = {
  dryRun: true;
  month: string;
  branchId: string;
  status: string;
  items: Array<PayrollItem & { userId: string }>;
  totals: { totalVnd: number; commissionVnd: number };
};

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatApiError(err: ApiClientError) {
  return `${err.code}: ${err.message}`;
}

export default function PayrollPage() {
  const router = useRouter();
  const [checkingRole, setCheckingRole] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [month, setMonth] = useState(currentMonth());
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [run, setRun] = useState<PayrollRun | null>(null);
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null);
  const [detail, setDetail] = useState<PayrollItem | null>(null);

  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const rows = useMemo(() => {
    if (dryRun) return dryRun.items;
    return run?.items || [];
  }, [dryRun, run]);

  const handleAuthError = useCallback((err: ApiClientError) => {
    if (err.code === "AUTH_MISSING_BEARER" || err.code === "AUTH_INVALID_TOKEN") {
      clearToken();
      router.replace("/login");
      return true;
    }
    return false;
  }, [router]);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [branchRes, payrollRes] = await Promise.all([
        fetchJson<{ items: Branch[] }>("/api/admin/branches", { token }),
        fetchJson<{ items: PayrollRun[] }>(`/api/admin/payroll?month=${month}${branchId ? `&branchId=${branchId}` : ""}&page=1&pageSize=1`, { token }),
      ]);
      setBranches(branchRes.items);
      if (!branchId && branchRes.items[0]) {
        setBranchId(branchRes.items[0].id);
      }
      setRun(payrollRes.items[0] || null);
      setDryRun(null);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, [branchId, handleAuthError, month]);

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
    if (isAdmin) void load();
  }, [isAdmin, load]);

  async function runPayroll(dry: boolean) {
    const token = getToken();
    if (!token || !branchId) return;
    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetchJson<{ dryRun?: boolean; run?: PayrollRun } & DryRunResult>("/api/admin/payroll/generate", {
        method: "POST",
        token,
        body: { month, branchId, dryRun: dry },
      });
      if (dry) {
        setDryRun(res as DryRunResult);
        setSuccess("Đã chạy thử bảng lương.");
      } else {
        setDryRun(null);
        setRun((res as { run?: PayrollRun }).run || null);
        setSuccess("Đã cập nhật bảng lương nháp.");
      }
      await load();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(formatApiError(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function finalizePayroll() {
    const token = getToken();
    if (!token || !branchId) return;
    if (!window.confirm("Bạn chắc chắn muốn chốt lương tháng này?")) return;
    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      await fetchJson<{ run: PayrollRun }>("/api/admin/payroll/finalize", {
        method: "POST",
        token,
        body: { month, branchId },
      });
      setSuccess("Đã chốt bảng lương.");
      await load();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(formatApiError(err));
    } finally {
      setActionLoading(false);
    }
  }

  if (checkingRole) return <div className="flex items-center gap-2 text-zinc-700"><Spinner /> Đang kiểm tra quyền...</div>;
  if (!isAdmin) return <Alert type="error" message="Bạn không có quyền truy cập." />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bảng lương"
        subtitle="Chạy lương theo tháng và chi nhánh"
        actions={<Button variant="secondary" onClick={() => void load()} disabled={loading}>Làm mới</Button>}
      />

      {error ? <Alert type="error" message={error} /> : null}
      {success ? <Alert type="success" message={success} /> : null}

      <FilterCard title="Thiết lập kỳ lương">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="space-y-1 text-sm text-zinc-700">
            <span>Tháng</span>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
          <label className="space-y-1 text-sm text-zinc-700 md:col-span-2">
            <span>Chi nhánh</span>
            <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </Select>
          </label>
          <div className="flex items-end gap-2">
            <Button variant="secondary" onClick={() => void runPayroll(true)} disabled={actionLoading || !branchId}>Chạy thử</Button>
            <Button onClick={() => void runPayroll(false)} disabled={actionLoading || !branchId}>Chạy bảng lương</Button>
            <Button variant="secondary" onClick={finalizePayroll} disabled={actionLoading || !run || run.status === "FINAL"}>Chốt lương</Button>
          </div>
        </div>
      </FilterCard>

      <div className="rounded-[16px] border border-[var(--border)] bg-white p-4 shadow-sm">
        <p className="text-sm text-zinc-600">
          Trạng thái: <span className="font-semibold text-zinc-900">{dryRun ? "DRY RUN" : run?.status || "Chưa có"}</span>
          {run?.generatedAt ? <span> - Cập nhật lúc {formatDateTimeVi(run.generatedAt)}</span> : null}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-zinc-700"><Spinner /> Đang tải dữ liệu...</div>
      ) : (
        <Table headers={["Nhân sự", "Công", "Lương theo công", "Phụ cấp", "Hoa hồng", "Thưởng/Phạt", "Tổng", "Chi tiết"]}>
          {rows.map((item) => (
            <tr key={item.id || `${item.userId}-${item.baseSalaryVnd}`} className="border-t border-zinc-100">
              <td className="px-3 py-2 text-sm text-zinc-900">{item.user?.name || item.user?.email || item.userId}</td>
              <td className="px-3 py-2 text-sm text-zinc-700">{item.daysWorked} / {item.standardDays}</td>
              <td className="px-3 py-2 text-sm text-zinc-700">{formatCurrencyVnd(item.baseProratedVnd)}</td>
              <td className="px-3 py-2 text-sm text-zinc-700">{formatCurrencyVnd(item.allowanceVnd)}</td>
              <td className="px-3 py-2 text-sm text-zinc-700">{formatCurrencyVnd(item.commissionVnd)}</td>
              <td className="px-3 py-2 text-sm text-zinc-700">{formatCurrencyVnd(item.bonusVnd - item.penaltyVnd)}</td>
              <td className="px-3 py-2 text-sm font-semibold text-zinc-900">{formatCurrencyVnd(item.totalVnd)}</td>
              <td className="px-3 py-2 text-sm">
                <Button variant="secondary" className="h-8 px-3" onClick={() => setDetail(item)}>Xem</Button>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Modal open={Boolean(detail)} title="Chi tiết breakdown" onClose={() => setDetail(null)}>
        <pre className="max-h-[420px] overflow-auto rounded-xl bg-zinc-900 p-3 text-xs text-zinc-100">
          {JSON.stringify(detail?.breakdownJson || {}, null, 2)}
        </pre>
      </Modal>
    </div>
  );
}
