"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, fetchMe, getToken } from "@/lib/auth-client";
import { isAdminRole } from "@/lib/admin-auth";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table } from "@/components/ui/table";

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
  const [checkingRole, setCheckingRole] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
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
      setError("Vui lòng chọn ít nhất một lead.");
      return;
    }

    setAssignSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await fetchJson<{ updated: number }>("/api/leads/assign", {
        method: "POST",
        token,
        body: { leadIds: selectedLeadIds, ownerId: selectedOwnerId },
      });
      setSuccess(`Đã gán ${result.updated} lead.`);
      setSelectedLeadIds([]);
      await loadLeads();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`Không thể gán lead: ${parseApiError(err)}`);
    } finally {
      setAssignSaving(false);
    }
  }

  async function autoAssign() {
    const token = getToken();
    if (!token) return;
    setAutoSaving(true);
    setError("");
    setSuccess("");
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
      setSuccess(`Tự chia thành công ${result.updated} lead.`);
      setSelectedLeadIds([]);
      setConfirmAutoOpen(false);
      await loadLeads();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`Không thể tự chia lead: ${parseApiError(err)}`);
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
          Quay về Leads
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Phân lead vận hành</h1>
        <Button variant="secondary" onClick={loadLeads} disabled={loading}>
          {loading ? "Đang tải..." : "Làm mới"}
        </Button>
      </div>

      {error ? <Alert type="error" message={error} /> : null}
      {success ? <Alert type="success" message={success} /> : null}

      <div className="grid gap-2 rounded-xl bg-white p-4 shadow-sm md:grid-cols-4">
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
          <option value="">Tất cả owner</option>
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
            Áp dụng lọc
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setFilters(EMPTY_FILTERS);
              setPage(1);
            }}
          >
            Xóa lọc
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div>
          {loading ? (
            <div className="rounded-xl bg-white p-6 text-sm text-zinc-600">Đang tải lead...</div>
          ) : items.length === 0 ? (
            <div className="rounded-xl bg-white p-6 text-sm text-zinc-600">Không có dữ liệu lead.</div>
          ) : (
            <Table headers={["", "Khách hàng", "SĐT", "Trạng thái", "Owner", "Ngày tạo"]}>
              {items.map((lead) => (
                <tr key={lead.id} className="border-t border-zinc-100">
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
                  <td className="px-3 py-2 text-sm text-zinc-600">{new Date(lead.createdAt).toLocaleString("vi-VN")}</td>
                </tr>
              ))}
            </Table>
          )}
          <div className="mt-2 flex items-center gap-2">
            <input type="checkbox" checked={allInPageSelected} onChange={toggleSelectAllPage} />
            <span className="text-sm text-zinc-600">Chọn tất cả lead trong trang</span>
          </div>
          <div className="mt-3">
            <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
          </div>
        </div>

        <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-zinc-900">Panel phân công</h2>
          <p className="text-sm text-zinc-600">Đã chọn: {selectedLeadIds.length} lead</p>
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
            {assignSaving ? "Đang gán..." : "Gán lead"}
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => setConfirmAutoOpen(true)} disabled={autoSaving}>
            {autoSaving ? "Đang tự chia..." : "Tự chia vòng tròn"}
          </Button>
        </div>
      </div>

      <Modal open={confirmAutoOpen} title="Xác nhận tự chia lead" onClose={() => setConfirmAutoOpen(false)}>
        <div className="space-y-3">
          <p className="text-sm text-zinc-700">
            {selectedLeadIds.length > 0
              ? `Bạn sẽ tự chia vòng tròn cho ${selectedLeadIds.length} lead đã chọn.`
              : "Bạn chưa chọn lead. Hệ thống sẽ tự chia theo bộ lọc hiện tại."}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmAutoOpen(false)}>
              Hủy
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
