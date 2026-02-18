"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, fetchMe, getToken } from "@/lib/auth-client";
import { isAdminRole } from "@/lib/admin-auth";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table } from "@/components/ui/table";
import { QuickSearchRow } from "@/components/admin/quick-search-row";
import { FiltersSheet } from "@/components/admin/filters-sheet";
import { AdminCardItem, AdminCardList } from "@/components/admin/admin-card-list";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/admin/ui-states";
import { formatCurrencyVnd, formatDateTimeVi } from "@/lib/date-utils";

type TuitionPlan = {
  id: string;
  province: string;
  licenseType: string;
  totalAmount: number;
  paid50Amount: number;
  tuition: number;
  note: string | null;
  isActive: boolean;
  createdAt: string;
};

type TuitionPlansResponse = {
  items: TuitionPlan[];
  page: number;
  pageSize: number;
  total: number;
};

function parseApiError(error: ApiClientError) {
  return `${error.code}: ${error.message}`;
}

function normalizeLicenseTypeInput(value: string) {
  return value.trim().toUpperCase();
}

export default function TuitionPlansAdminPage() {
  const router = useRouter();
  const toast = useToast();
  const [checkingRole, setCheckingRole] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [items, setItems] = useState<TuitionPlan[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [province, setProvince] = useState("");
  const [licenseType, setLicenseType] = useState("");
  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createForm, setCreateForm] = useState({
    province: "",
    licenseType: "",
    totalAmount: "",
    paid50Amount: "",
    note: "",
    isActive: true,
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editTarget, setEditTarget] = useState<TuitionPlan | null>(null);
  const [editForm, setEditForm] = useState({
    province: "",
    licenseType: "",
    totalAmount: "",
    paid50Amount: "",
    note: "",
    isActive: true,
  });

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (q.trim()) params.set("q", q.trim());
    if (province.trim()) params.set("province", province.trim());
    if (licenseType) params.set("licenseType", licenseType);
    if (activeFilter) params.set("isActive", activeFilter);
    return params.toString();
  }, [activeFilter, licenseType, page, pageSize, province, q]);

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

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(qInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [qInput]);

  const loadTuitionPlans = useCallback(async () => {
    const token = getToken();
    if (!token || !isAdmin) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson<TuitionPlansResponse>(`/api/tuition-plans?${query}`, { token });
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
    if (!isAdmin) return;
    loadTuitionPlans();
  }, [isAdmin, loadTuitionPlans]);

  async function createPlan() {
    const token = getToken();
    if (!token) return;
    const totalAmount = Number(createForm.totalAmount);
    const paid50Amount = createForm.paid50Amount ? Number(createForm.paid50Amount) : Math.floor(totalAmount * 0.5);

    if (!createForm.province.trim()) {
      setError("Vui lòng nhập tỉnh.");
      return;
    }
    const normalizedLicenseType = normalizeLicenseTypeInput(createForm.licenseType);
    if (!normalizedLicenseType || normalizedLicenseType.length > 16) {
      setError("Hạng bằng không hợp lệ (tối đa 16 ký tự).");
      return;
    }
    if (!Number.isInteger(totalAmount) || totalAmount <= 0) {
      setError("Tổng học phí phải là số nguyên dương.");
      return;
    }
    if (!Number.isInteger(paid50Amount) || paid50Amount <= 0) {
      setError("Mốc 50% phải là số nguyên dương.");
      return;
    }

    setCreateSaving(true);
    setError("");
    try {
      await fetchJson("/api/tuition-plans", {
        method: "POST",
        token,
        body: {
          province: createForm.province.trim(),
          licenseType: normalizedLicenseType,
          totalAmount,
          paid50Amount,
          note: createForm.note || undefined,
          isActive: createForm.isActive,
        },
      });
      setCreateOpen(false);
      setCreateForm({ province: "", licenseType: "", totalAmount: "", paid50Amount: "", note: "", isActive: true });
      toast.success("Tạo bảng học phí thành công.");
      await loadTuitionPlans();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`Không thể tạo bảng học phí: ${parseApiError(err)}`);
    } finally {
      setCreateSaving(false);
    }
  }

  function openEdit(item: TuitionPlan) {
    setEditTarget(item);
    setEditForm({
      province: item.province,
      licenseType: item.licenseType,
      totalAmount: String(item.totalAmount || item.tuition),
      paid50Amount: String(item.paid50Amount || Math.floor((item.totalAmount || item.tuition) * 0.5)),
      note: item.note || "",
      isActive: item.isActive,
    });
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editTarget) return;
    const token = getToken();
    if (!token) return;
    const totalAmount = Number(editForm.totalAmount);
    const paid50Amount = Number(editForm.paid50Amount);

    if (!editForm.province.trim()) {
      setError("Vui lòng nhập tỉnh.");
      return;
    }
    const normalizedLicenseType = normalizeLicenseTypeInput(editForm.licenseType);
    if (!normalizedLicenseType || normalizedLicenseType.length > 16) {
      setError("Hạng bằng không hợp lệ (tối đa 16 ký tự).");
      return;
    }
    if (!Number.isInteger(totalAmount) || totalAmount <= 0) {
      setError("Tổng học phí phải là số nguyên dương.");
      return;
    }
    if (!Number.isInteger(paid50Amount) || paid50Amount <= 0) {
      setError("Mốc 50% phải là số nguyên dương.");
      return;
    }

    setEditSaving(true);
    setError("");
    try {
      await fetchJson(`/api/tuition-plans/${editTarget.id}`, {
        method: "PATCH",
        token,
        body: {
          province: editForm.province.trim(),
          licenseType: normalizedLicenseType,
          totalAmount,
          paid50Amount,
          note: editForm.note || null,
          isActive: editForm.isActive,
        },
      });
      setEditOpen(false);
      setEditTarget(null);
      toast.success("Cập nhật bảng học phí thành công.");
      await loadTuitionPlans();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`Không thể cập nhật: ${parseApiError(err)}`);
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
      {/* ── Premium Header ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-rose-600 via-pink-600 to-fuchsia-600 p-4 text-white shadow-lg shadow-rose-200 animate-fadeInUp">
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/10 blur-xl" />
        <div className="relative flex flex-wrap items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-2xl backdrop-blur-sm">💰</div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">Bảng học phí</h2>
            <p className="text-sm text-white/80">Quản trị chính sách học phí</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={loadTuitionPlans} disabled={loading} className="!bg-white/20 !text-white !border-white/30 hover:!bg-white/30">
              {loading ? "Đang tải..." : "🔄 Làm mới"}
            </Button>
            <Button onClick={() => setCreateOpen(true)} className="!bg-white !text-rose-700 hover:!bg-white/90">➕ Tạo bảng học phí</Button>
          </div>
        </div>
      </div>

      {error ? <Alert type="error" message={error} /> : null}

      <QuickSearchRow
        value={qInput}
        onChange={setQInput}
        onOpenFilter={() => setMobileFilterOpen(true)}
        placeholder="Tìm theo tỉnh hoặc ghi chú"
        activeFilterCount={[province, licenseType, activeFilter].filter(Boolean).length}
      />

      <FiltersSheet
        open={mobileFilterOpen}
        onOpenChange={setMobileFilterOpen}
        title="Bộ lọc bảng học phí"
        onApply={() => {
          setPage(1);
        }}
        onClear={() => {
          setProvince("");
          setLicenseType("");
          setActiveFilter("");
        }}
      >
        <div className="space-y-3">
          <label className="space-y-1 text-sm text-zinc-700">
            <span>Tỉnh</span>
            <Input value={province} onChange={(e) => setProvince(e.target.value)} placeholder="VD: Hồ Chí Minh" />
          </label>
          <label className="space-y-1 text-sm text-zinc-700">
            <span>Hạng bằng</span>
            <Input value={licenseType} onChange={(e) => setLicenseType(e.target.value)} placeholder="VD: B, C1, D..." />
          </label>
          <label className="space-y-1 text-sm text-zinc-700">
            <span>Trạng thái</span>
            <Select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value as "" | "true" | "false")}>
              <option value="">Tất cả</option>
              <option value="true">Đang áp dụng</option>
              <option value="false">Ngưng áp dụng</option>
            </Select>
          </label>
        </div>
      </FiltersSheet>

      <div className="hidden overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm md:block animate-fadeInUp" style={{ animationDelay: "80ms" }}>
        <div className="h-1 bg-gradient-to-r from-rose-500 to-pink-500" />
        <div className="p-4">
          <h3 className="text-sm font-semibold text-zinc-800 mb-3">🔍 Bộ lọc</h3>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="mb-1 block text-sm text-zinc-600">Tìm kiếm</label>
              <Input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Tỉnh hoặc ghi chú" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-600">Tỉnh</label>
              <Input value={province} onChange={(e) => setProvince(e.target.value)} placeholder="VD: Hồ Chí Minh" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-600">Hạng bằng</label>
              <Input value={licenseType} onChange={(e) => setLicenseType(e.target.value)} placeholder="VD: B, C1, D, E..." />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-600">Trạng thái</label>
              <Select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value as "" | "true" | "false")}>
                <option value="">Tất cả</option>
                <option value="true">Đang áp dụng</option>
                <option value="false">Ngưng áp dụng</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-600">Kích thước trang</label>
              <Select value={String(pageSize)} onChange={(e) => { setPage(1); setPageSize(Number(e.target.value)); }}>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton text="Đang tải dữ liệu..." />
      ) : items.length === 0 ? (
        <EmptyState text="Không có dữ liệu" />
      ) : (
        <div className="space-y-3">
          {error ? <ErrorState detail={error} /> : null}
          <AdminCardList>
            {items.map((item) => (
              <AdminCardItem
                key={`mobile-${item.id}`}
                title={`${item.province} • ${item.licenseType}`}
                subtitle={formatDateTimeVi(item.createdAt)}
                meta={
                  <div className="space-y-1">
                    <p>Tổng học phí: {formatCurrencyVnd(item.totalAmount || item.tuition)}</p>
                    <p>Mốc từ 50%: {formatCurrencyVnd(item.paid50Amount || Math.floor((item.totalAmount || item.tuition) * 0.5))}</p>
                    <p>Trạng thái: {item.isActive ? "Đang áp dụng" : "Ngưng áp dụng"}</p>
                  </div>
                }
                primaryAction={{ label: "Sửa", onClick: () => openEdit(item) }}
              />
            ))}
          </AdminCardList>
          <div className="hidden md:block">
            <Table headers={["Tỉnh", "Hạng bằng", "Tổng học phí", "Mốc >= 50%", "Ghi chú", "Trạng thái", "Ngày tạo", "Hành động"]}>
              {items.map((item, idx) => (
                <tr key={item.id} className="border-t border-zinc-100 transition-colors hover:bg-zinc-50 animate-fadeInUp" style={{ animationDelay: `${160 + Math.min(idx * 30, 200)}ms` }}>
                  <td className="px-3 py-2">{item.province}</td>
                  <td className="px-3 py-2">{item.licenseType}</td>
                  <td className="px-3 py-2">{formatCurrencyVnd(item.totalAmount || item.tuition)}</td>
                  <td className="px-3 py-2">{formatCurrencyVnd(item.paid50Amount || Math.floor((item.totalAmount || item.tuition) * 0.5))}</td>
                  <td className="px-3 py-2">{item.note || "-"}</td>
                  <td className="px-3 py-2">
                    <Badge text={item.isActive ? "Đang áp dụng" : "Ngưng áp dụng"} />
                  </td>
                  <td className="px-3 py-2">{formatDateTimeVi(item.createdAt)}</td>
                  <td className="px-3 py-2">
                    <Button variant="secondary" onClick={() => openEdit(item)}>
                      Sửa
                    </Button>
                  </td>
                </tr>
              ))}
            </Table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        </div>
      )}

      <Modal open={createOpen} title="Tạo bảng học phí" onClose={() => setCreateOpen(false)}>
        <div className="space-y-3">
          <Input placeholder="Tỉnh" value={createForm.province} onChange={(e) => setCreateForm((s) => ({ ...s, province: e.target.value }))} />
          <Input
            placeholder="Hạng bằng (VD: B, C1, D, E...)"
            value={createForm.licenseType}
            maxLength={16}
            onChange={(e) => setCreateForm((s) => ({ ...s, licenseType: e.target.value }))}
          />
          <Input type="number" min={1} placeholder="Tổng học phí" value={createForm.totalAmount} onChange={(e) => setCreateForm((s) => ({ ...s, totalAmount: e.target.value }))} />
          <Input type="number" min={1} placeholder="Mốc >= 50% (để trống sẽ tự tính)" value={createForm.paid50Amount} onChange={(e) => setCreateForm((s) => ({ ...s, paid50Amount: e.target.value }))} />
          <Input placeholder="Ghi chú" value={createForm.note} onChange={(e) => setCreateForm((s) => ({ ...s, note: e.target.value }))} />
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" checked={createForm.isActive} onChange={(e) => setCreateForm((s) => ({ ...s, isActive: e.target.checked }))} />
            Đang áp dụng
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Hủy
            </Button>
            <Button onClick={createPlan} disabled={createSaving}>
              {createSaving ? "Đang lưu..." : "Lưu"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={editOpen} title="Sửa bảng học phí" onClose={() => setEditOpen(false)}>
        <div className="space-y-3">
          <Input placeholder="Tỉnh" value={editForm.province} onChange={(e) => setEditForm((s) => ({ ...s, province: e.target.value }))} />
          <Input
            placeholder="Hạng bằng (VD: B, C1, D, E...)"
            value={editForm.licenseType}
            maxLength={16}
            onChange={(e) => setEditForm((s) => ({ ...s, licenseType: e.target.value }))}
          />
          <Input type="number" min={1} placeholder="Tổng học phí" value={editForm.totalAmount} onChange={(e) => setEditForm((s) => ({ ...s, totalAmount: e.target.value }))} />
          <Input type="number" min={1} placeholder="Mốc >= 50%" value={editForm.paid50Amount} onChange={(e) => setEditForm((s) => ({ ...s, paid50Amount: e.target.value }))} />
          <Input placeholder="Ghi chú" value={editForm.note} onChange={(e) => setEditForm((s) => ({ ...s, note: e.target.value }))} />
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm((s) => ({ ...s, isActive: e.target.checked }))} />
            Đang áp dụng
          </label>
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
