"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, getToken } from "@/lib/auth-client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table } from "@/components/ui/table";

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
  const [items, setItems] = useState<Course[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
    setSuccess("");
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
      setSuccess("Tạo khóa học thành công.");
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
    setSuccess("");
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
      setSuccess("Cập nhật khóa học thành công.");
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-900">Khóa học</h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={loadCourses} disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <Spinner /> Đang tải...
              </span>
            ) : (
              "Làm mới"
            )}
          </Button>
          <Button onClick={() => setCreateOpen(true)}>Tạo khóa học</Button>
        </div>
      </div>

      {error ? <Alert type="error" message={error} /> : null}
      {success ? <Alert type="success" message={success} /> : null}

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <label className="mb-1 block text-sm text-zinc-600">Tìm mã/tên</label>
            <Input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Nhập mã khóa, loại bằng hoặc tỉnh"
            />
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

      {loading ? (
        <div className="rounded-xl bg-white p-6 text-sm text-zinc-600">Đang tải danh sách khóa học...</div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-xl bg-white p-6 text-sm text-zinc-600">
          Không có dữ liệu khóa học phù hợp bộ lọc.
        </div>
      ) : (
        <Table headers={["Mã khóa", "Tên/Loại", "Tỉnh/Chi nhánh", "Ngày tạo", "Hành động"]}>
          {filteredItems.map((item) => (
            <tr key={item.id} className="border-t border-zinc-100">
              <td className="px-3 py-2">
                <p className="font-medium text-zinc-900">{item.code}</p>
              </td>
              <td className="px-3 py-2">{item.licenseType || "-"}</td>
              <td className="px-3 py-2">{item.province || "-"}</td>
              <td className="px-3 py-2 text-sm text-zinc-600">{new Date(item.createdAt).toLocaleString("vi-VN")}</td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/courses/${item.id}`}
                    className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                  >
                    Mở
                  </Link>
                  <Button variant="secondary" className="h-7 px-2 py-1 text-xs" onClick={() => openEditModal(item)}>
                    Sửa
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
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
              Hủy
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
              Hủy
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
