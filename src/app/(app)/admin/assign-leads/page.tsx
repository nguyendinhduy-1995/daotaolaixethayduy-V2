"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, fetchMe, getToken } from "@/lib/auth-client";
import { isAdminRole } from "@/lib/admin-auth";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table } from "@/components/ui/table";
import { formatDateTimeVi } from "@/lib/date-utils";

type Lead = {
  id: string;
  fullName: string | null;
  phone: string | null;
  source: string | null;
  channel: string | null;
  licenseType: string | null;
  status: string;
  ownerId: string | null;
  createdAt: string;
  owner?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
};

type LeadListResponse = {
  items: Lead[];
  page: number;
  pageSize: number;
  total: number;
};

type UserOption = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isActive: boolean;
};

type UsersResponse = {
  items: UserOption[];
};

const STATUS_OPTIONS = ["NEW", "HAS_PHONE", "APPOINTED", "ARRIVED", "SIGNED", "STUDYING", "EXAMED", "RESULT", "LOST"];

type Filters = {
  q: string;
  source: string;
  channel: string;
  licenseType: string;
  status: string;
  ownerId: string;
  createdFrom: string;
  createdTo: string;
};

const EMPTY_FILTERS: Filters = {
  q: "",
  source: "",
  channel: "",
  licenseType: "",
  status: "",
  ownerId: "",
  createdFrom: "",
  createdTo: "",
};

function parseApiError(err: ApiClientError) {
  return `${err.code}: ${err.message}`;
}

export default function AdminAssignLeadsPage() {
  const router = useRouter();
  const toast = useToast();
  const [checkingRole, setCheckingRole] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [items, setItems] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);

  const [owners, setOwners] = useState<UserOption[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [assignSaving, setAssignSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [confirmAutoOpen, setConfirmAutoOpen] = useState(false);

  useEffect(() => {
    fetchMe()
      .then((data) => {
        setIsAdmin(isAdminRole(data.user.role));
      })
      .catch(() => {
        clearToken();
        router.replace("/login");
      })
      .finally(() => setCheckingRole(false));
  }, [router]);

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

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    params.set("sort", "createdAt");
    params.set("order", "desc");
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    return params.toString();
  }, [filters, page, pageSize]);

  const loadOwners = useCallback(async () => {
    if (!isAdmin) return;
    const token = getToken();
    if (!token) return;
    try {
      const data = await fetchJson<UsersResponse>("/api/users?page=1&pageSize=100&role=telesales&isActive=true", { token });
      setOwners(data.items.filter((item) => item.role === "telesales" && item.isActive));
    } catch {
      setOwners([]);
    }
  }, [isAdmin]);

  const loadLeads = useCallback(async () => {
    if (!isAdmin) return;
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson<LeadListResponse>(`/api/leads?${query}`, { token });
      setItems(data.items);
      setTotal(data.total);
      setSelectedLeadIds((prev) => prev.filter((id) => data.items.some((item) => item.id === id)));
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`Có lỗi xảy ra: ${parseApiError(err)}`);
    } finally {
      setLoading(false);
    }
  }, [handleAuthError, isAdmin, query]);

  useEffect(() => {
    loadOwners();
  }, [loadOwners]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const allInPageSelected = items.length > 0 && items.every((item) => selectedLeadIds.includes(item.id));

  function toggleSelectAllPage() {
    if (allInPageSelected) {
      setSelectedLeadIds((prev) => prev.filter((id) => !items.some((item) => item.id === id)));
      return;
    }
    setSelectedLeadIds((prev) => Array.from(new Set([...prev, ...items.map((item) => item.id)])));
  }

  function toggleLead(id: string) {
    setSelectedLeadIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  async function bulkAssign() {
    const token = getToken();
    if (!token) return;
    if (!selectedOwnerId) {
      setError("Vui lòng chọn telesales để gán.");
      return;
    }
    if (selectedLeadIds.length === 0) {
      setError("Vui lòng chọn ít nhất một khách hàng.");
      return;
    }

    setAssignSaving(true);
    setError("");
    try {
      const result = await fetchJson<{ updated: number }>("/api/leads/assign", {
        method: "POST",
        token,
        body: { leadIds: selectedLeadIds, ownerId: selectedOwnerId },
      });
      toast.success(`Đã gán ${result.updated} khách hàng.`);
      setSelectedLeadIds([]);
      await loadLeads();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`Không thể gán khách hàng: ${parseApiError(err)}`);
    } finally {
      setAssignSaving(false);
    }
  }

  async function autoAssign() {
    const token = getToken();
    if (!token) return;
    setAutoSaving(true);
    setError("");
    try {
      const body =
        selectedLeadIds.length > 0
          ? { strategy: "round_robin", leadIds: selectedLeadIds }
          : { strategy: "round_robin", filters };

      const result = await fetchJson<{ updated: number; assigned: Array<{ leadId: string; ownerId: string }> }>(
        "/api/leads/auto-assign",
        {
          method: "POST",
          token,
          body,
        }
      );
      toast.success(`Tự chia thành công ${result.updated} khách hàng.`);
      setSelectedLeadIds([]);
      setConfirmAutoOpen(false);
      await loadLeads();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`Không thể tự chia khách hàng: ${parseApiError(err)}`);
    } finally {
      setAutoSaving(false);
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
        <Link href="/leads" className="inline-block rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700">
          Quay về Khách hàng
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Premium Header ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-600 via-orange-600 to-red-500 p-4 text-white shadow-lg shadow-amber-200 animate-fadeInUp">
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/10 blur-xl" />
        <div className="relative flex flex-wrap items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-2xl backdrop-blur-sm">📨</div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">Phân khách hàng vận hành</h2>
            <p className="text-sm text-white/80">Gán và phân chia khách hàng cho telesales</p>
          </div>
          <Button variant="secondary" onClick={loadLeads} disabled={loading} className="!bg-white/20 !text-white !border-white/30 hover:!bg-white/30">
            {loading ? "Đang tải..." : "🔄 Làm mới"}
          </Button>
        </div>
      </div>

      {error ? <Alert type="error" message={error} /> : null}

      <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm animate-fadeInUp" style={{ animationDelay: "80ms" }}>
        <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
        <div className="p-4">
          <h3 className="text-sm font-semibold text-zinc-800 mb-3">🔍 Bộ lọc</h3>
          <div className="grid gap-2 md:grid-cols-4">
            <Input placeholder="Tìm kiếm tên/SĐT" value={filters.q} onChange={(e) => setFilters((s) => ({ ...s, q: e.target.value }))} />
            <Select value={filters.status} onChange={(e) => setFilters((s) => ({ ...s, status: e.target.value }))}>
              <option value="">Tất cả trạng thái</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
            <Input placeholder="Nguồn" value={filters.source} onChange={(e) => setFilters((s) => ({ ...s, source: e.target.value }))} />
            <Input placeholder="Kênh" value={filters.channel} onChange={(e) => setFilters((s) => ({ ...s, channel: e.target.value }))} />
            <Input placeholder="Hạng bằng" value={filters.licenseType} onChange={(e) => setFilters((s) => ({ ...s, licenseType: e.target.value }))} />
            <Select value={filters.ownerId} onChange={(e) => setFilters((s) => ({ ...s, ownerId: e.target.value }))}>
              <option value="">Tất cả người phụ trách</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name || owner.email}
                </option>
              ))}
            </Select>
            <Input type="date" value={filters.createdFrom} onChange={(e) => setFilters((s) => ({ ...s, createdFrom: e.target.value }))} />
            <Input type="date" value={filters.createdTo} onChange={(e) => setFilters((s) => ({ ...s, createdTo: e.target.value }))} />
            <div className="md:col-span-4 flex flex-wrap gap-2">
              <Select value={String(pageSize)} onChange={(e) => setPageSize(Number(e.target.value))}>
                <option value="20">20 / trang</option>
                <option value="50">50 / trang</option>
                <option value="100">100 / trang</option>
              </Select>
              <Button
                onClick={() => {
                  setPage(1);
                  loadLeads();
                }}
              >
                Áp dụng bộ lọc
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setFilters(EMPTY_FILTERS);
                  setPage(1);
                }}
              >
                Xoá bộ lọc
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div>
          {loading ? (
            <div className="animate-pulse space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
                  <div className="h-4 w-4 rounded bg-zinc-200" />
                  <div className="flex-1 space-y-2"><div className="h-4 w-1/3 rounded bg-zinc-200" /><div className="h-3 w-1/4 rounded bg-zinc-100" /></div>
                  <div className="h-6 w-16 rounded-full bg-zinc-200" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl bg-white p-6 text-sm text-zinc-600">Không có dữ liệu khách hàng.</div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm animate-fadeInUp" style={{ animationDelay: "160ms" }}>
              <Table headers={["", "Khách hàng", "SĐT", "Trạng thái", "Người phụ trách", "Ngày tạo"]}>
                {items.map((lead, idx) => (
                  <tr key={lead.id} className="border-t border-zinc-100 transition-colors hover:bg-zinc-50 animate-fadeInUp" style={{ animationDelay: `${160 + Math.min(idx * 30, 200)}ms` }}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedLeadIds.includes(lead.id)}
                        onChange={() => toggleLead(lead.id)}
                      />
                    </td>
                    <td className="px-3 py-2">{lead.fullName || "-"}</td>
                    <td className="px-3 py-2">{lead.phone || "-"}</td>
                    <td className="px-3 py-2">{lead.status}</td>
                    <td className="px-3 py-2">{lead.owner?.name || lead.owner?.email || "-"}</td>
                    <td className="px-3 py-2 text-sm text-zinc-600">{formatDateTimeVi(lead.createdAt)}</td>
                  </tr>
                ))}
              </Table>
            </div>
          )}
          <div className="mt-2 flex items-center gap-2">
            <input type="checkbox" checked={allInPageSelected} onChange={toggleSelectAllPage} />
            <span className="text-sm text-zinc-600">Chọn tất cả khách hàng trong trang</span>
          </div>
          <div className="mt-3">
            <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm animate-fadeInUp" style={{ animationDelay: "160ms" }}>
          <div className="h-1 bg-gradient-to-r from-orange-500 to-red-500" />
          <div className="space-y-3 p-4">
            <h2 className="text-base font-semibold text-zinc-900">📌 Panel phân công</h2>
            <p className="text-sm text-zinc-600">Đã chọn: {selectedLeadIds.length} khách hàng</p>
            <div>
              <label className="mb-1 block text-sm text-zinc-600">Telesales</label>
              <Select value={selectedOwnerId} onChange={(e) => setSelectedOwnerId(e.target.value)}>
                <option value="">Chọn telesales</option>
                {owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name || owner.email}
                  </option>
                ))}
              </Select>
            </div>
            <Button className="w-full" onClick={bulkAssign} disabled={assignSaving}>
              {assignSaving ? "Đang gán..." : "Gán khách hàng"}
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => setConfirmAutoOpen(true)} disabled={autoSaving}>
              {autoSaving ? "Đang tự chia..." : "Tự chia vòng tròn"}
            </Button>
          </div>
        </div>
      </div>

      <Modal open={confirmAutoOpen} title="Xác nhận tự chia khách hàng" onClose={() => setConfirmAutoOpen(false)}>
        <div className="space-y-3">
          <p className="text-sm text-zinc-700">
            {selectedLeadIds.length > 0
              ? `Bạn sẽ tự chia vòng tròn cho ${selectedLeadIds.length} khách hàng đã chọn.`
              : "Bạn chưa chọn khách hàng. Hệ thống sẽ tự chia theo bộ lọc hiện tại."}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmAutoOpen(false)}>
              Huỷ
            </Button>
            <Button onClick={autoAssign} disabled={autoSaving}>
              {autoSaving ? "Đang xử lý..." : "Xác nhận"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
