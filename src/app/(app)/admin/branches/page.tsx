"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, fetchMe, getToken } from "@/lib/auth-client";
import { isAdminRole } from "@/lib/admin-auth";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table } from "@/components/ui/table";
import { DataCard } from "@/components/mobile/DataCard";
import { EmptyState } from "@/components/mobile/EmptyState";
import { MobileHeader } from "@/components/app/mobile-header";
import { MobileToolbar } from "@/components/app/mobile-toolbar";
import { MobileFiltersSheet } from "@/components/mobile/MobileFiltersSheet";
import { formatCurrencyVnd, formatDateTimeVi } from "@/lib/date-utils";

type BranchItem = {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
  commissionPerPaid50: number | null;
  createdAt: string;
  updatedAt: string;
};

type BranchListResponse = {
  items: BranchItem[];
  page: number;
  pageSize: number;
  total: number;
};

type FormState = {
  name: string;
  code: string;
  isActive: boolean;
  commissionPerPaid50: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  code: "",
  isActive: true,
  commissionPerPaid50: "",
};

function parseApiError(error: ApiClientError) {
  return `${error.code}: ${error.message}`;
}

export default function AdminBranchesPage() {
  const router = useRouter();
  const [checkingRole, setCheckingRole] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [items, setItems] = useState<BranchItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createForm, setCreateForm] = useState<FormState>(EMPTY_FORM);

  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editTarget, setEditTarget] = useState<BranchItem | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (q.trim()) params.set("q", q.trim());
    if (activeFilter) params.set("isActive", activeFilter);
    return params.toString();
  }, [activeFilter, page, pageSize, q]);

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

  const loadBranches = useCallback(async () => {
    const token = getToken();
    if (!token || !isAdmin) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson<BranchListResponse>(`/api/admin/branches?${query}`, { token });
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`Có lỗi xảy ra: ${parseApiError(err)}`);
    } finally {
      setLoading(false);
    }
  }, [handleAuthError, isAdmin, query]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(qInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [qInput]);

  useEffect(() => {
    if (!isAdmin) return;
    loadBranches();
  }, [isAdmin, loadBranches]);

  function normalizeCommission(value: string) {
    const text = value.trim();
    if (!text) return null;
    const n = Number(text);
    if (!Number.isInteger(n) || n < 0) return undefined;
    return n;
  }

  async function createBranch() {
    const token = getToken();
    if (!token) return;
    if (!createForm.name.trim()) {
      setError("Vui lòng nhập tên chi nhánh.");
      return;
    }
    const commission = normalizeCommission(createForm.commissionPerPaid50);
    if (commission === undefined) {
      setError("Hoa hồng/HS đạt 50% phải là số nguyên không âm.");
      return;
    }

    setCreateSaving(true);
    setError("");
    setSuccess("");
    try {
      await fetchJson<{ branch: BranchItem }>("/api/admin/branches", {
        method: "POST",
        token,
        body: {
          name: createForm.name.trim(),
          code: createForm.code.trim() || null,
          isActive: createForm.isActive,
          commissionPerPaid50: commission,
        },
      });
      setCreateOpen(false);
      setCreateForm(EMPTY_FORM);
      setSuccess("Tạo chi nhánh thành công.");
      await loadBranches();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`Không thể tạo chi nhánh: ${parseApiError(err)}`);
    } finally {
      setCreateSaving(false);
    }
  }

  function openEdit(branch: BranchItem) {
    setEditTarget(branch);
    setEditForm({
      name: branch.name,
      code: branch.code || "",
      isActive: branch.isActive,
      commissionPerPaid50:
        typeof branch.commissionPerPaid50 === "number" ? String(branch.commissionPerPaid50) : "",
    });
    setEditOpen(true);
  }

  async function saveEdit() {
    const token = getToken();
    if (!token || !editTarget) return;
    if (!editForm.name.trim()) {
      setError("Vui lòng nhập tên chi nhánh.");
      return;
    }
    const commission = normalizeCommission(editForm.commissionPerPaid50);
    if (commission === undefined) {
      setError("Hoa hồng/HS đạt 50% phải là số nguyên không âm.");
      return;
    }

    setEditSaving(true);
    setError("");
    setSuccess("");
    try {
      await fetchJson<{ branch: BranchItem }>(`/api/admin/branches/${editTarget.id}`, {
        method: "PATCH",
        token,
        body: {
          name: editForm.name.trim(),
          code: editForm.code.trim() || null,
          isActive: editForm.isActive,
          commissionPerPaid50: commission,
        },
      });
      setEditOpen(false);
      setEditTarget(null);
      setSuccess("Cập nhật chi nhánh thành công.");
      await loadBranches();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`Không thể cập nhật chi nhánh: ${parseApiError(err)}`);
    } finally {
      setEditSaving(false);
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
      <MobileHeader
        title="Quản trị chi nhánh"
        subtitle="Quản lý thông tin chi nhánh"
        rightActions={<Button onClick={() => setCreateOpen(true)}>Tạo</Button>}
      />

      <div className="hidden md:block">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-zinc-900">Quản trị chi nhánh</h1>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={loadBranches} disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <Spinner /> Đang tải...
                </span>
              ) : (
                "Làm mới"
              )}
            </Button>
            <Button onClick={() => setCreateOpen(true)}>Tạo chi nhánh</Button>
          </div>
        </div>
      </div>

      {error ? <Alert type="error" message={error} /> : null}
      {success ? <Alert type="success" message={success} /> : null}

      <div className="sticky top-[116px] z-20 rounded-2xl border border-zinc-200 bg-zinc-100/90 p-2 backdrop-blur md:hidden">
        <MobileToolbar
          value={qInput}
          onChange={setQInput}
          onOpenFilter={() => setMobileFilterOpen(true)}
          activeFilterCount={(q ? 1 : 0) + (activeFilter ? 1 : 0)}
          quickActions={
            <>
              <Button variant="secondary" onClick={loadBranches}>
                Làm mới
              </Button>
              <Button onClick={() => setCreateOpen(true)}>Tạo chi nhánh</Button>
            </>
          }
        />
      </div>

      <div className="hidden rounded-xl bg-white p-4 shadow-sm md:block">
        <div className="grid gap-2 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Tìm kiếm</label>
            <Input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Tên hoặc mã" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Trạng thái</label>
            <Select
              value={activeFilter}
              onChange={(e) => {
                setPage(1);
                setActiveFilter(e.target.value as "" | "true" | "false");
              }}
            >
              <option value="">Tất cả</option>
              <option value="true">Đang hoạt động</option>
              <option value="false">Tạm ngưng</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Kích thước trang</label>
            <Select
              value={String(pageSize)}
              onChange={(e) => {
                setPage(1);
                setPageSize(Number(e.target.value));
              }}
            >
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </Select>
          </div>
        </div>
      </div>

      <div className="space-y-2 md:hidden">
        {loading ? (
          <div className="surface rounded-2xl px-3 py-6 text-center text-sm text-zinc-600">Đang tải danh sách chi nhánh...</div>
        ) : items.length === 0 ? (
          <EmptyState title="Không có chi nhánh" description="Hãy tạo chi nhánh mới để bắt đầu." />
        ) : (
          items.map((branch) => (
            <DataCard
              key={branch.id}
              title={branch.name}
              subtitle={branch.code || "Chưa có mã"}
              badge={<Badge text={branch.isActive ? "Đang hoạt động" : "Tạm ngưng"} />}
              footer={
                <Button variant="secondary" onClick={() => openEdit(branch)}>
                  Sửa
                </Button>
              }
            >
              <div className="space-y-1 text-xs">
                <p>
                  <span className="text-zinc-500">Hoa hồng/HS 50%:</span>{" "}
                  {branch.commissionPerPaid50 !== null ? formatCurrencyVnd(branch.commissionPerPaid50) : "-"}
                </p>
                <p>
                  <span className="text-zinc-500">Tạo lúc:</span> {formatDateTimeVi(branch.createdAt)}
                </p>
              </div>
            </DataCard>
          ))
        )}
      </div>

      <div className="hidden md:block">
        {loading ? (
          <div className="rounded-xl bg-white p-6 text-sm text-zinc-600">Đang tải danh sách chi nhánh...</div>
        ) : items.length === 0 ? (
          <div className="rounded-xl bg-white p-6 text-sm text-zinc-600">Không có dữ liệu chi nhánh.</div>
        ) : (
          <Table headers={["Tên chi nhánh", "Mã", "Trạng thái", "Hoa hồng/HS 50%", "Ngày tạo", "Hành động"]}>
            {items.map((branch) => (
              <tr key={branch.id} className="border-t border-zinc-100">
                <td className="px-3 py-2">{branch.name}</td>
                <td className="px-3 py-2">{branch.code || "-"}</td>
                <td className="px-3 py-2">
                  <Badge text={branch.isActive ? "Đang hoạt động" : "Tạm ngưng"} />
                </td>
                <td className="px-3 py-2">{branch.commissionPerPaid50 !== null ? formatCurrencyVnd(branch.commissionPerPaid50) : "-"}</td>
                <td className="px-3 py-2 text-sm text-zinc-600">{formatDateTimeVi(branch.createdAt)}</td>
                <td className="px-3 py-2">
                  <Button variant="secondary" className="h-7 px-2 py-1 text-xs" onClick={() => openEdit(branch)}>
                    Sửa
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>

      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />

      <MobileFiltersSheet
        open={mobileFilterOpen}
        onOpenChange={setMobileFilterOpen}
        title="Bộ lọc chi nhánh"
        onApply={() => setPage(1)}
        onReset={() => {
          setQInput("");
          setQ("");
          setActiveFilter("");
          setPage(1);
        }}
      >
        <div className="space-y-3">
          <Input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Tên hoặc mã" />
          <Select
            value={activeFilter}
            onChange={(e) => {
              setPage(1);
              setActiveFilter(e.target.value as "" | "true" | "false");
            }}
          >
            <option value="">Tất cả</option>
            <option value="true">Đang hoạt động</option>
            <option value="false">Tạm ngưng</option>
          </Select>
          <Select
            value={String(pageSize)}
            onChange={(e) => {
              setPage(1);
              setPageSize(Number(e.target.value));
            }}
          >
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </Select>
        </div>
      </MobileFiltersSheet>

      <Modal open={createOpen} title="Tạo chi nhánh" onClose={() => setCreateOpen(false)}>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Tên chi nhánh *</label>
            <Input value={createForm.name} onChange={(e) => setCreateForm((s) => ({ ...s, name: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Mã chi nhánh</label>
            <Input value={createForm.code} onChange={(e) => setCreateForm((s) => ({ ...s, code: e.target.value }))} placeholder="Ví dụ: HCM" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Hoa hồng/HS đạt 50% (VND)</label>
            <Input
              inputMode="numeric"
              value={createForm.commissionPerPaid50}
              onChange={(e) => setCreateForm((s) => ({ ...s, commissionPerPaid50: e.target.value.replace(/[^0-9]/g, "") }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Trạng thái</label>
            <Select
              value={createForm.isActive ? "true" : "false"}
              onChange={(e) => setCreateForm((s) => ({ ...s, isActive: e.target.value === "true" }))}
            >
              <option value="true">Đang hoạt động</option>
              <option value="false">Tạm ngưng</option>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Hủy
            </Button>
            <Button onClick={createBranch} disabled={createSaving}>
              {createSaving ? "Đang tạo..." : "Tạo chi nhánh"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={editOpen} title="Sửa chi nhánh" onClose={() => setEditOpen(false)}>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Tên chi nhánh *</label>
            <Input value={editForm.name} onChange={(e) => setEditForm((s) => ({ ...s, name: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Mã chi nhánh</label>
            <Input value={editForm.code} onChange={(e) => setEditForm((s) => ({ ...s, code: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Hoa hồng/HS đạt 50% (VND)</label>
            <Input
              inputMode="numeric"
              value={editForm.commissionPerPaid50}
              onChange={(e) => setEditForm((s) => ({ ...s, commissionPerPaid50: e.target.value.replace(/[^0-9]/g, "") }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Trạng thái</label>
            <Select
              value={editForm.isActive ? "true" : "false"}
              onChange={(e) => setEditForm((s) => ({ ...s, isActive: e.target.value === "true" }))}
            >
              <option value="true">Đang hoạt động</option>
              <option value="false">Tạm ngưng</option>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(false)}>
              Hủy
            </Button>
            <Button onClick={saveEdit} disabled={editSaving}>
              {editSaving ? "Đang lưu..." : "Lưu"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
