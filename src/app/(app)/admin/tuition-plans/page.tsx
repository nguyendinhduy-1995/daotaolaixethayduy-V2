"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  const [success, setSuccess] = useState("");

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
    setSuccess("");
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
      setSuccess("Tạo bảng học phí thành công.");
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
    setSuccess("");
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
      setSuccess("Cập nhật bảng học phí thành công.");
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-900">Bảng học phí</h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={loadTuitionPlans} disabled={loading}>
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Spinner /> Đang tải...
              </span>
            ) : (
              "Làm mới"
            )}
          </Button>
          <Button onClick={() => setCreateOpen(true)}>Tạo bảng học phí</Button>
        </div>
      </div>

      {error ? <Alert type="error" message={error} /> : null}
      {success ? <Alert type="success" message={success} /> : null}

      <div className="rounded-xl bg-white p-4 shadow-sm">
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

      {loading ? (
        <div className="flex items-center gap-2 text-zinc-700">
          <Spinner /> Đang tải dữ liệu...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl bg-white p-6 text-sm text-zinc-600 shadow-sm">Không có dữ liệu</div>
      ) : (
        <div className="space-y-3">
          <Table headers={["Tỉnh", "Hạng bằng", "Tổng học phí", "Mốc >= 50%", "Ghi chú", "Trạng thái", "Ngày tạo", "Hành động"]}>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-zinc-100">
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
