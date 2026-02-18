"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, getToken } from "@/lib/auth-client";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Table } from "@/components/ui/table";
import { formatDateTimeVi } from "@/lib/date-utils";

type Course = {
  id: string;
  code: string;
  province: string | null;
  licenseType: string | null;
  startDate: string | null;
  examDate: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type CourseListResponse = {
  items: Course[];
  page: number;
  pageSize: number;
  total: number;
};

function parseApiError(err: ApiClientError) {
  return `${err.code}: ${err.message}`;
}

export default function CoursesPage() {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<Course[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createForm, setCreateForm] = useState({
    code: "",
    province: "",
    licenseType: "",
    startDate: "",
    examDate: "",
    description: "",
    isActive: true,
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editId, setEditId] = useState("");
  const [editForm, setEditForm] = useState({
    code: "",
    province: "",
    licenseType: "",
    startDate: "",
    examDate: "",
    description: "",
    isActive: true,
  });

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (q.trim()) params.set("code", q.trim());
    return params.toString();
  }, [page, pageSize, q]);

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

  const filteredItems = useMemo(() => {
    if (!q.trim()) return items;
    const keyword = q.trim().toLowerCase();
    return items.filter((item) =>
      [item.code, item.licenseType || "", item.province || ""].some((value) =>
        value.toLowerCase().includes(keyword)
      )
    );
  }, [items, q]);

  const loadCourses = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson<CourseListResponse>(`/api/courses?${query}`, { token });
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`Có lỗi xảy ra: ${parseApiError(err)}`);
    } finally {
      setLoading(false);
    }
  }, [handleAuthError, query]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(qInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [qInput]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  async function createCourse() {
    const token = getToken();
    if (!token) return;
    if (!createForm.code.trim()) {
      setError("Vui lòng nhập mã khóa học.");
      return;
    }

    setCreateSaving(true);
    setError("");

    try {
      const data = await fetchJson<{ course: Course }>("/api/courses", {
        method: "POST",
        token,
        body: {
          code: createForm.code.trim(),
          province: createForm.province || null,
          licenseType: createForm.licenseType || null,
          startDate: createForm.startDate || null,
          examDate: createForm.examDate || null,
          description: createForm.description || null,
          isActive: createForm.isActive,
        },
      });
      setCreateOpen(false);
      setCreateForm({
        code: "",
        province: "",
        licenseType: "",
        startDate: "",
        examDate: "",
        description: "",
        isActive: true,
      });
      toast.success("Tạo khóa học thành công.");
      router.push(`/courses/${data.course.id}`);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`Không thể tạo khóa học: ${parseApiError(err)}`);
    } finally {
      setCreateSaving(false);
    }
  }

  function openEditModal(item: Course) {
    setEditId(item.id);
    setEditForm({
      code: item.code,
      province: item.province || "",
      licenseType: item.licenseType || "",
      startDate: item.startDate ? item.startDate.slice(0, 10) : "",
      examDate: item.examDate ? item.examDate.slice(0, 10) : "",
      description: item.description || "",
      isActive: item.isActive,
    });
    setEditOpen(true);
  }

  async function updateCourse() {
    const token = getToken();
    if (!token || !editId) return;
    if (!editForm.code.trim()) {
      setError("Mã khóa học không được để trống.");
      return;
    }
    setEditSaving(true);
    setError("");
    try {
      await fetchJson<{ course: Course }>(`/api/courses/${editId}`, {
        method: "PATCH",
        token,
        body: {
          code: editForm.code.trim(),
          province: editForm.province || null,
          licenseType: editForm.licenseType || null,
          startDate: editForm.startDate || null,
          examDate: editForm.examDate || null,
          description: editForm.description || null,
          isActive: editForm.isActive,
        },
      });
      setEditOpen(false);
      toast.success("Cập nhật khóa học thành công.");
      await loadCourses();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`Không thể cập nhật khóa học: ${parseApiError(err)}`);
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Premium Header ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 p-4 text-white shadow-lg shadow-violet-200 animate-fadeInUp">
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/10 blur-xl" />
        <div className="relative flex flex-wrap items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-2xl backdrop-blur-sm">📚</div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">Khóa học</h2>
            <p className="text-sm text-white/80">Quản lý khóa học đào tạo lái xe</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-sm font-bold backdrop-blur-sm">📊 {total}</span>
            <Button variant="secondary" onClick={loadCourses} disabled={loading} className="!bg-white/20 !text-white !border-white/30 hover:!bg-white/30">
              {loading ? "\u0110ang t\u1EA3i..." : "L\u00E0m m\u1EDBi"}
            </Button>
            <Button onClick={() => setCreateOpen(true)} className="!bg-white/20 !text-white !border-white/30 hover:!bg-white/30">➕ Tạo khóa</Button>
          </div>
        </div>
      </div>

      {error ? <Alert type="error" message={error} /> : null}


      {/* ── Filters ── */}
      <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm animate-fadeInUp" style={{ animationDelay: "80ms" }}>
        <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-500" />
        <div className="grid gap-2 p-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-400">🔍 Tìm mã/tên</label>
            <Input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Nhập mã khóa, loại bằng hoặc tỉnh" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-400">Kích thước trang</label>
            <Select value={String(pageSize)} onChange={(e) => { setPage(1); setPageSize(Number(e.target.value)); }}>
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </Select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
              <div className="h-9 w-9 rounded-lg bg-zinc-200" />
              <div className="flex-1 space-y-2"><div className="h-4 w-1/4 rounded bg-zinc-200" /><div className="h-3 w-1/2 rounded bg-zinc-100" /></div>
              <div className="h-6 w-16 rounded-full bg-zinc-200" />
            </div>
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-white p-8 text-center animate-fadeInUp">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-2xl">📭</div>
          <p className="font-medium text-zinc-700">Không có dữ liệu khóa học</p>
          <p className="mt-1 text-sm text-zinc-500">Không có khóa học phù hợp bộ lọc.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm animate-fadeInUp" style={{ animationDelay: "160ms" }}>
          <Table headers={["Mã khóa", "Tên/Loại", "Tỉnh/Chi nhánh", "Trạng thái", "Ngày tạo", ""]}>
            {filteredItems.map((item, idx) => (
              <tr key={item.id} className="border-t border-zinc-100 transition-colors hover:bg-zinc-50 animate-fadeInUp" style={{ animationDelay: `${160 + Math.min(idx * 40, 300)}ms` }}>
                <td className="px-3 py-2">
                  <span className="rounded-full bg-violet-50 border border-violet-200 px-2 py-0.5 text-xs font-bold text-violet-700">{item.code}</span>
                </td>
                <td className="px-3 py-2 text-sm text-zinc-700">{item.licenseType || "-"}</td>
                <td className="px-3 py-2 text-sm text-zinc-700">{item.province || "-"}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold border ${item.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-zinc-100 text-zinc-600 border-zinc-200"}`}>
                    {item.isActive ? "✅ Hoạt động" : "⏸️ Ngừng"}
                  </span>
                </td>
                <td className="px-3 py-2 text-sm text-zinc-600">{formatDateTimeVi(item.createdAt)}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Link href={`/courses/${item.id}`} className="rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 px-3 py-1 text-xs font-medium text-white shadow-sm hover:shadow-md transition">Mở</Link>
                    <Button variant="secondary" className="h-7 px-2 py-1 text-xs" onClick={() => openEditModal(item)}>Sửa</Button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />

      <Modal open={createOpen} title="Tạo khóa học" onClose={() => setCreateOpen(false)}>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Mã khóa học *</label>
            <Input value={createForm.code} onChange={(e) => setCreateForm((s) => ({ ...s, code: e.target.value }))} />
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-zinc-600">Loại bằng</label>
              <Input
                value={createForm.licenseType}
                onChange={(e) => setCreateForm((s) => ({ ...s, licenseType: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-600">Tỉnh/Chi nhánh</label>
              <Input value={createForm.province} onChange={(e) => setCreateForm((s) => ({ ...s, province: e.target.value }))} />
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-zinc-600">Ngày bắt đầu</label>
              <Input type="date" value={createForm.startDate} onChange={(e) => setCreateForm((s) => ({ ...s, startDate: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-600">Ngày thi</label>
              <Input type="date" value={createForm.examDate} onChange={(e) => setCreateForm((s) => ({ ...s, examDate: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Mô tả</label>
            <Input
              value={createForm.description}
              onChange={(e) => setCreateForm((s) => ({ ...s, description: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Trạng thái</label>
            <Select
              value={createForm.isActive ? "true" : "false"}
              onChange={(e) => setCreateForm((s) => ({ ...s, isActive: e.target.value === "true" }))}
            >
              <option value="true">Đang hoạt động</option>
              <option value="false">Ngừng hoạt động</option>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Huỷ
            </Button>
            <Button onClick={createCourse} disabled={createSaving}>
              {createSaving ? "Đang tạo..." : "Tạo khóa học"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={editOpen} title="Sửa khóa học" onClose={() => setEditOpen(false)}>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Mã khóa học *</label>
            <Input value={editForm.code} onChange={(e) => setEditForm((s) => ({ ...s, code: e.target.value }))} />
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-zinc-600">Loại bằng</label>
              <Input
                value={editForm.licenseType}
                onChange={(e) => setEditForm((s) => ({ ...s, licenseType: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-600">Tỉnh/Chi nhánh</label>
              <Input value={editForm.province} onChange={(e) => setEditForm((s) => ({ ...s, province: e.target.value }))} />
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-zinc-600">Ngày bắt đầu</label>
              <Input type="date" value={editForm.startDate} onChange={(e) => setEditForm((s) => ({ ...s, startDate: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-600">Ngày thi</label>
              <Input type="date" value={editForm.examDate} onChange={(e) => setEditForm((s) => ({ ...s, examDate: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Mô tả</label>
            <Input
              value={editForm.description}
              onChange={(e) => setEditForm((s) => ({ ...s, description: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Trạng thái</label>
            <Select
              value={editForm.isActive ? "true" : "false"}
              onChange={(e) => setEditForm((s) => ({ ...s, isActive: e.target.value === "true" }))}
            >
              <option value="true">Đang hoạt động</option>
              <option value="false">Ngừng hoạt động</option>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(false)}>
              Huỷ
            </Button>
            <Button onClick={updateCourse} disabled={editSaving}>
              {editSaving ? "Đang lưu..." : "Lưu"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
