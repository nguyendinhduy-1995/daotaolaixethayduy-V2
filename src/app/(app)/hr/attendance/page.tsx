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
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table } from "@/components/ui/table";
import { formatDateVi } from "@/lib/date-utils";

type AttendanceRow = {
  id: string;
  userId: string;
  branchId: string;
  date: string;
  status: string;
  minutesLate: number | null;
  note: string | null;
  source: string;
  user: { id: string; name: string | null; email: string };
  branch: { id: string; name: string };
};

type UserOption = { id: string; name: string | null; email: string };
type BranchOption = { id: string; name: string };

const STATUS_OPTIONS = [
  "PRESENT",
  "HALF",
  "OFF",
  "LEAVE_PAID",
  "LEAVE_UNPAID",
  "LATE",
  "ABSENT",
] as const;

const STATUS_LABEL: Record<string, string> = {
  PRESENT: "Đi làm",
  HALF: "Nửa ngày",
  OFF: "Nghỉ",
  LEAVE_PAID: "Nghỉ phép hưởng lương",
  LEAVE_UNPAID: "Nghỉ không lương",
  LATE: "Đi muộn",
  ABSENT: "Vắng",
};

function formatApiError(err: ApiClientError) {
  return `${err.code}: ${err.message}`;
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function AttendancePage() {
  const router = useRouter();
  const [checkingRole, setCheckingRole] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [items, setItems] = useState<AttendanceRow[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(31);
  const [total, setTotal] = useState(0);

  const [month, setMonth] = useState(currentMonth());
  const [filterBranchId, setFilterBranchId] = useState("");
  const [filterUserId, setFilterUserId] = useState("");

  const [formUserId, setFormUserId] = useState("");
  const [formBranchId, setFormBranchId] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formStatus, setFormStatus] = useState<(typeof STATUS_OPTIONS)[number]>("PRESENT");
  const [formMinutesLate, setFormMinutesLate] = useState("0");
  const [formNote, setFormNote] = useState("");

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), month });
    if (filterBranchId) params.set("branchId", filterBranchId);
    if (filterUserId) params.set("userId", filterUserId);
    return params.toString();
  }, [filterBranchId, filterUserId, month, page, pageSize]);

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

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [att, usersRes, branchesRes] = await Promise.all([
        fetchJson<{ items: AttendanceRow[]; total: number }>(`/api/admin/attendance?${query}`, { token }),
        fetchJson<{ items: UserOption[] }>("/api/users?page=1&pageSize=200&isActive=true", { token }),
        fetchJson<{ items: BranchOption[] }>("/api/admin/branches", { token }),
      ]);
      setItems(att.items);
      setTotal(att.total);
      setUsers(usersRes.items);
      setBranches(branchesRes.items);
      if (!formUserId && usersRes.items[0]) setFormUserId(usersRes.items[0].id);
      if (!formBranchId && branchesRes.items[0]) setFormBranchId(branchesRes.items[0].id);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, [formBranchId, formUserId, handleAuthError, query]);

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

  async function upsertAttendance() {
    const token = getToken();
    if (!token) return;
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await fetchJson<{ attendance: AttendanceRow }>("/api/admin/attendance", {
        method: "POST",
        token,
        body: {
          userId: formUserId,
          branchId: formBranchId,
          date: formDate,
          status: formStatus,
          minutesLate: Number(formMinutesLate),
          note: formNote || null,
          source: "MANUAL",
        },
      });
      setSuccess("Đã lưu chấm công.");
      await load();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingRole) return <div className="flex items-center gap-2 text-zinc-700"><Spinner /> Đang kiểm tra quyền...</div>;
  if (!isAdmin) return <Alert type="error" message="Bạn không có quyền truy cập." />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Chấm công"
        subtitle="Theo dõi ngày công theo nhân sự và chi nhánh"
        actions={<Button variant="secondary" onClick={() => void load()} disabled={loading}>Làm mới</Button>}
      />

      {error ? <Alert type="error" message={error} /> : null}
      {success ? <Alert type="success" message={success} /> : null}

      <FilterCard title="Bộ lọc">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="space-y-1 text-sm text-zinc-700">
            <span>Tháng</span>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
          <label className="space-y-1 text-sm text-zinc-700">
            <span>Chi nhánh</span>
            <Select value={filterBranchId} onChange={(e) => setFilterBranchId(e.target.value)}>
              <option value="">Tất cả</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </label>
          <label className="space-y-1 text-sm text-zinc-700">
            <span>Nhân sự</span>
            <Select value={filterUserId} onChange={(e) => setFilterUserId(e.target.value)}>
              <option value="">Tất cả</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
            </Select>
          </label>
          <div className="flex items-end">
            <Button onClick={() => { setPage(1); void load(); }} disabled={loading}>Áp dụng</Button>
          </div>
        </div>
      </FilterCard>

      <FilterCard title="Chấm công nhanh">
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
          <label className="space-y-1 text-sm text-zinc-700">
            <span>Nhân sự</span>
            <Select value={formUserId} onChange={(e) => setFormUserId(e.target.value)}>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
            </Select>
          </label>
          <label className="space-y-1 text-sm text-zinc-700">
            <span>Chi nhánh</span>
            <Select value={formBranchId} onChange={(e) => setFormBranchId(e.target.value)}>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </label>
          <label className="space-y-1 text-sm text-zinc-700">
            <span>Ngày</span>
            <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
          </label>
          <label className="space-y-1 text-sm text-zinc-700">
            <span>Trạng thái</span>
            <Select value={formStatus} onChange={(e) => setFormStatus(e.target.value as (typeof STATUS_OPTIONS)[number])}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </Select>
          </label>
          <label className="space-y-1 text-sm text-zinc-700">
            <span>Phút đi muộn</span>
            <Input type="number" min={0} value={formMinutesLate} onChange={(e) => setFormMinutesLate(e.target.value)} />
          </label>
          <label className="space-y-1 text-sm text-zinc-700 md:col-span-2">
            <span>Ghi chú</span>
            <Input value={formNote} onChange={(e) => setFormNote(e.target.value)} placeholder="Ghi chú thêm" />
          </label>
          <div className="flex items-end">
            <Button onClick={upsertAttendance} disabled={submitting || !formUserId || !formBranchId}>Lưu chấm công</Button>
          </div>
        </div>
      </FilterCard>

      {loading ? (
        <div className="flex items-center gap-2 text-zinc-700"><Spinner /> Đang tải dữ liệu...</div>
      ) : (
        <>
          <Table headers={["Ngày", "Nhân sự", "Chi nhánh", "Trạng thái", "Đi muộn", "Nguồn", "Ghi chú"]}>
            {items.map((row) => (
              <tr key={row.id} className="border-t border-zinc-100">
                <td className="px-3 py-2 text-sm text-zinc-700">{formatDateVi(row.date)}</td>
                <td className="px-3 py-2 text-sm text-zinc-900">{row.user.name || row.user.email}</td>
                <td className="px-3 py-2 text-sm text-zinc-700">{row.branch.name}</td>
                <td className="px-3 py-2 text-sm text-zinc-700">{STATUS_LABEL[row.status] || row.status}</td>
                <td className="px-3 py-2 text-sm text-zinc-700">{row.minutesLate ?? 0}</td>
                <td className="px-3 py-2 text-sm text-zinc-700">{row.source}</td>
                <td className="px-3 py-2 text-sm text-zinc-700">{row.note || "-"}</td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
