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

type Branch = { id: string; name: string; commissionPerPaid50: number | null };

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

type Paid50RebuildResult = {
  ok: boolean;
  dryRun: boolean;
  month: string;
  branchId: string | null;
  created: number;
  previewCount: number;
  totalCommissionVnd: number;
  summary: {
    skipNoThreshold: number;
    skipWrongMonth: number;
    skipAlreadyCounted: number;
    skipMissingOwner: number;
    skipMissingBranch: number;
    skipMissingRate: number;
    skippedByBranchScope: number;
  };
  preview: Array<{
    studentId: string;
    studentName: string;
    ownerName: string;
    amountVnd: number;
    reachedAt: string;
    paid50Amount: number;
    totalPaidAllTime: number;
  }>;
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
  const [commissionPerPaid50Input, setCommissionPerPaid50Input] = useState("");
  const [paid50Preview, setPaid50Preview] = useState<Paid50RebuildResult | null>(null);
  const [paid50ModalOpen, setPaid50ModalOpen] = useState(false);

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
        setCommissionPerPaid50Input(
          branchRes.items[0].commissionPerPaid50 !== null ? String(branchRes.items[0].commissionPerPaid50) : ""
        );
      } else if (branchId) {
        const selected = branchRes.items.find((branch) => branch.id === branchId);
        setCommissionPerPaid50Input(
          selected?.commissionPerPaid50 !== null && selected?.commissionPerPaid50 !== undefined
            ? String(selected.commissionPerPaid50)
            : ""
        );
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

  async function saveBranchCommission() {
    const token = getToken();
    if (!token || !branchId) return;
    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      const normalized =
        commissionPerPaid50Input.trim() === "" ? null : Number(commissionPerPaid50Input.trim());
      if (normalized !== null && (!Number.isInteger(normalized) || normalized < 0)) {
        setError("VALIDATION_ERROR: Hoa hồng phải là số nguyên không âm.");
        return;
      }
      await fetchJson<{ branch: Branch }>(`/api/admin/branches/${branchId}`, {
        method: "PATCH",
        token,
        body: { commissionPerPaid50: normalized },
      });
      setSuccess("Đã lưu mức hoa hồng theo chi nhánh.");
      await load();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(formatApiError(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function previewPaid50Commission() {
    const token = getToken();
    if (!token || !branchId) return;
    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetchJson<Paid50RebuildResult>("/api/admin/commissions/paid50/rebuild", {
        method: "POST",
        token,
        body: { month, branchId, dryRun: true },
      });
      setPaid50Preview(res);
      setPaid50ModalOpen(true);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(formatApiError(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function runPaid50Commission() {
    const token = getToken();
    if (!token || !branchId) return;
    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetchJson<Paid50RebuildResult>("/api/admin/commissions/paid50/rebuild", {
        method: "POST",
        token,
        body: { month, branchId, dryRun: false },
      });
      setPaid50Preview(res);
      setSuccess(`Đã tạo ${res.created} ledger hoa hồng PAID50.`);
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
            <Select value={branchId} onChange={(e) => {
              setBranchId(e.target.value);
              const selected = branches.find((branch) => branch.id === e.target.value);
              setCommissionPerPaid50Input(
                selected?.commissionPerPaid50 !== null && selected?.commissionPerPaid50 !== undefined
                  ? String(selected.commissionPerPaid50)
                  : ""
              );
            }}>
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
        <div className="grid gap-3 md:grid-cols-4">
          <label className="space-y-1 text-sm text-zinc-700 md:col-span-2">
            <span>Hoa hồng/HS đạt 50% (VND)</span>
            <Input
              type="number"
              min={0}
              value={commissionPerPaid50Input}
              onChange={(e) => setCommissionPerPaid50Input(e.target.value)}
              placeholder="Ví dụ: 300000"
            />
          </label>
          <div className="flex items-end gap-2 md:col-span-2">
            <Button variant="secondary" onClick={saveBranchCommission} disabled={actionLoading || !branchId}>
              Lưu mức hoa hồng
            </Button>
            <Button variant="secondary" onClick={previewPaid50Commission} disabled={actionLoading || !branchId}>
              Tính hoa hồng HS đạt 50%
            </Button>
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

      <Modal
        open={paid50ModalOpen}
        title="Preview hoa hồng HS đạt 50%"
        onClose={() => setPaid50ModalOpen(false)}
      >
        {paid50Preview ? (
          <div className="space-y-3 text-sm text-zinc-700">
            <p>
              Tháng: <span className="font-semibold text-zinc-900">{paid50Preview.month}</span> - Số bản ghi dự kiến:{" "}
              <span className="font-semibold text-zinc-900">{paid50Preview.previewCount}</span>
            </p>
            <p>
              Tổng tiền hoa hồng:{" "}
              <span className="font-semibold text-zinc-900">{formatCurrencyVnd(paid50Preview.totalCommissionVnd)}</span>
            </p>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs">
              Bỏ qua: chưa đạt mốc {paid50Preview.summary.skipNoThreshold}, sai tháng {paid50Preview.summary.skipWrongMonth}, đã tính trước đó{" "}
              {paid50Preview.summary.skipAlreadyCounted}, thiếu owner {paid50Preview.summary.skipMissingOwner}, thiếu chi nhánh{" "}
              {paid50Preview.summary.skipMissingBranch}, thiếu rate {paid50Preview.summary.skipMissingRate}.
            </div>
            {paid50Preview.preview.length === 0 ? (
              <p>Không có học viên đủ điều kiện trong tháng này.</p>
            ) : (
              <Table headers={["Học viên", "Telesale", "Mốc 50%", "Mức hoa hồng"]}>
                {paid50Preview.preview.map((row) => (
                  <tr key={row.studentId} className="border-t border-zinc-100">
                    <td className="px-3 py-2 text-sm text-zinc-900">{row.studentName}</td>
                    <td className="px-3 py-2 text-sm text-zinc-700">{row.ownerName}</td>
                    <td className="px-3 py-2 text-sm text-zinc-700">{formatDateTimeVi(row.reachedAt)}</td>
                    <td className="px-3 py-2 text-sm font-semibold text-zinc-900">{formatCurrencyVnd(row.amountVnd)}</td>
                  </tr>
                ))}
              </Table>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPaid50ModalOpen(false)}>Đóng</Button>
              <Button onClick={runPaid50Commission} disabled={actionLoading}>
                Chạy thật
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-zinc-700"><Spinner /> Đang tải preview...</div>
        )}
      </Modal>
    </div>
  );
}
