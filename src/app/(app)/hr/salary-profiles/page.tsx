"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, fetchMe, getToken } from "@/lib/auth-client";
import { isAdminRole } from "@/lib/admin-auth";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table } from "@/components/ui/table";
import { formatCurrencyVnd, formatDateVi } from "@/lib/date-utils";

type UserOption = { id: string; name: string | null; email: string };
type BranchOption = { id: string; name: string };
type SalaryProfile = {
  id: string;
  userId: string;
  branchId: string;
  roleTitle: string;
  baseSalaryVnd: number;
  allowanceVnd: number;
  standardDays: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  user: { id: string; name: string | null; email: string };
  branch: { id: string; name: string };
};

type ListResponse = { items: SalaryProfile[]; page: number; pageSize: number; total: number };

function formatApiError(err: ApiClientError) {
  return `${err.code}: ${err.message}`;
}

export default function SalaryProfilesPage() {
  const router = useRouter();
  const toast = useToast();
  const [checkingRole, setCheckingRole] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [items, setItems] = useState<SalaryProfile[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [userId, setUserId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [roleTitle, setRoleTitle] = useState("Telesales");
  const [baseSalaryVnd, setBaseSalaryVnd] = useState("7000000");
  const [allowanceVnd, setAllowanceVnd] = useState("0");
  const [standardDays, setStandardDays] = useState("26");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));

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
      const [profiles, usersRes, branchesRes] = await Promise.all([
        fetchJson<ListResponse>(`/api/admin/salary-profiles?page=${page}&pageSize=${pageSize}`, { token }),
        fetchJson<{ items: UserOption[] }>("/api/users?page=1&pageSize=200&isActive=true", { token }),
        fetchJson<{ items: BranchOption[] }>("/api/admin/branches", { token }),
      ]);
      setItems(profiles.items);
      setTotal(profiles.total);
      setUsers(usersRes.items);
      setBranches(branchesRes.items);
      if (!userId && usersRes.items.length > 0) setUserId(usersRes.items[0].id);
      if (!branchId && branchesRes.items.length > 0) setBranchId(branchesRes.items[0].id);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, [branchId, handleAuthError, page, pageSize, userId]);

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

  async function createProfile() {
    const token = getToken();
    if (!token) return;
    setSubmitting(true);
    setError("");
    try {
      await fetchJson<{ profile: SalaryProfile }>("/api/admin/salary-profiles", {
        method: "POST",
        token,
        body: {
          userId,
          branchId,
          roleTitle,
          baseSalaryVnd: Number(baseSalaryVnd),
          allowanceVnd: Number(allowanceVnd),
          standardDays: Number(standardDays),
          effectiveFrom,
        },
      });
      toast.success("Đã tạo hồ sơ lương.");
      await load();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingRole) {
    return <div className="flex items-center gap-2 text-zinc-700"><Spinner /> Đang kiểm tra quyền...</div>;
  }

  if (!isAdmin) {
    return <Alert type="error" message="Bạn không có quyền truy cập." />;
  }

  return (
    <div className="space-y-4">
      {/* ── Premium Header ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-rose-600 via-pink-600 to-fuchsia-600 p-4 text-white shadow-lg shadow-rose-200 animate-fadeInUp">
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/10 blur-xl" />
        <div className="relative flex flex-wrap items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-2xl backdrop-blur-sm">💼</div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">Hồ sơ lương</h2>
            <p className="text-sm text-white/80">Quản lý mức lương cơ bản và phụ cấp theo nhân sự</p>
          </div>
          <Button variant="secondary" onClick={() => void load()} disabled={loading} className="!bg-white/20 !text-white !border-white/30 hover:!bg-white/30">🔄 Làm mới</Button>
        </div>
      </div>

      {error ? <Alert type="error" message={error} /> : null}

      <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm animate-fadeInUp" style={{ animationDelay: "80ms" }}>
        <div className="h-1 bg-gradient-to-r from-rose-500 to-pink-500" />
        <div className="p-4">
          <h3 className="text-sm font-semibold text-zinc-800 mb-3">➕ Tạo hồ sơ lương</h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <label className="space-y-1 text-sm text-zinc-700">
              <span>Nhân sự</span>
              <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name || u.email}</option>
                ))}
              </Select>
            </label>
            <label className="space-y-1 text-sm text-zinc-700">
              <span>Chi nhánh</span>
              <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </Select>
            </label>
            <label className="space-y-1 text-sm text-zinc-700">
              <span>Chức danh</span>
              <Input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} />
            </label>
            <label className="space-y-1 text-sm text-zinc-700">
              <span>Lương cơ bản (VNĐ)</span>
              <Input type="number" min={0} value={baseSalaryVnd} onChange={(e) => setBaseSalaryVnd(e.target.value)} />
            </label>
            <label className="space-y-1 text-sm text-zinc-700">
              <span>Phụ cấp (VNĐ)</span>
              <Input type="number" min={0} value={allowanceVnd} onChange={(e) => setAllowanceVnd(e.target.value)} />
            </label>
            <label className="space-y-1 text-sm text-zinc-700">
              <span>Ngày công chuẩn</span>
              <Input type="number" min={1} value={standardDays} onChange={(e) => setStandardDays(e.target.value)} />
            </label>
            <label className="space-y-1 text-sm text-zinc-700">
              <span>Hiệu lực từ ngày</span>
              <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
            </label>
          </div>
          <div>
            <Button onClick={createProfile} disabled={submitting || !userId || !branchId}>Tạo hồ sơ</Button>
          </div>
        </div>
      </div>

      {
        loading ? (
          <div className="animate-pulse space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
                <div className="h-8 w-8 rounded-lg bg-zinc-200" />
                <div className="flex-1 space-y-2"><div className="h-4 w-1/4 rounded bg-zinc-200" /><div className="h-3 w-1/2 rounded bg-zinc-100" /></div>
                <div className="h-6 w-20 rounded-full bg-zinc-200" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm animate-fadeInUp" style={{ animationDelay: "160ms" }}>
              <Table headers={["Nhân sự", "Chi nhánh", "Chức danh", "Lương cơ bản", "Phụ cấp", "Ngày công", "Hiệu lực"]}>
                {items.map((item, idx) => (
                  <tr key={item.id} className="border-t border-zinc-100 transition-colors hover:bg-zinc-50 animate-fadeInUp" style={{ animationDelay: `${160 + Math.min(idx * 30, 200)}ms` }}>
                    <td className="px-3 py-2 text-sm text-zinc-900">{item.user.name || item.user.email}</td>
                    <td className="px-3 py-2 text-sm text-zinc-700">{item.branch.name}</td>
                    <td className="px-3 py-2 text-sm text-zinc-700">{item.roleTitle}</td>
                    <td className="px-3 py-2 text-sm text-zinc-700">{formatCurrencyVnd(item.baseSalaryVnd)}</td>
                    <td className="px-3 py-2 text-sm text-zinc-700">{formatCurrencyVnd(item.allowanceVnd)}</td>
                    <td className="px-3 py-2 text-sm text-zinc-700">{item.standardDays}</td>
                    <td className="px-3 py-2 text-sm text-zinc-700">{formatDateVi(item.effectiveFrom)}</td>
                  </tr>
                ))}
              </Table>
            </div>
            <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
          </>
        )
      }
    </div>
  );
}
