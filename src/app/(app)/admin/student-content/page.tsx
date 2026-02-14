"use client";

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
import { formatDateVi } from "@/lib/date-utils";

type Item = {
  id: string;
  category: "HUONG_DAN" | "MEO_HOC" | "HO_SO" | "THI";
  title: string;
  body: string;
  isPublished: boolean;
  createdAt: string;
};

type ListResponse = {
  items: Item[];
  page: number;
  pageSize: number;
  total: number;
};

function categoryLabel(value: Item["category"]) {
  if (value === "HUONG_DAN") return "Hướng dẫn";
  if (value === "MEO_HOC") return "Mẹo học";
  if (value === "HO_SO") return "Hồ sơ";
  return "Thi";
}

export default function AdminStudentContentPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [isPublished, setIsPublished] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState({ category: "HUONG_DAN", title: "", body: "", isPublished: false });

  const query = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("pageSize", String(pageSize));
    if (q.trim()) p.set("q", q.trim());
    if (category) p.set("category", category);
    if (isPublished) p.set("isPublished", isPublished);
    return p.toString();
  }, [category, isPublished, page, pageSize, q]);

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
      const data = await fetchJson<ListResponse>(`/api/admin/student-content?${query}`, { token });
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`${err.code}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [handleAuthError, query]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    const token = getToken();
    if (!token) return;
    setError("");
    setSuccess("");
    try {
      if (editing) {
        await fetchJson(`/api/admin/student-content/${editing.id}`, {
          method: "PATCH",
          token,
          body: form,
        });
        setSuccess("Đã cập nhật nội dung.");
      } else {
        await fetchJson("/api/admin/student-content", {
          method: "POST",
          token,
          body: form,
        });
        setSuccess("Đã tạo nội dung.");
      }
      setOpenForm(false);
      setEditing(null);
      setForm({ category: "HUONG_DAN", title: "", body: "", isPublished: false });
      await load();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`${err.code}: ${err.message}`);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-900">Quản trị nội dung học viên</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={load} disabled={loading}>{loading ? "Đang tải..." : "Làm mới"}</Button>
          <Button
            onClick={() => {
              setEditing(null);
              setForm({ category: "HUONG_DAN", title: "", body: "", isPublished: false });
              setOpenForm(true);
            }}
          >
            Tạo nội dung
          </Button>
        </div>
      </div>
      {error ? <Alert type="error" message={error} /> : null}
      {success ? <Alert type="success" message={success} /> : null}

      <div className="grid gap-2 rounded-xl bg-white p-4 shadow-sm md:grid-cols-3">
        <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Tìm tiêu đề/nội dung" />
        <Select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
          <option value="">Tất cả danh mục</option>
          <option value="HUONG_DAN">Hướng dẫn</option>
          <option value="MEO_HOC">Mẹo học</option>
          <option value="HO_SO">Hồ sơ</option>
          <option value="THI">Thi</option>
        </Select>
        <Select value={isPublished} onChange={(e) => { setIsPublished(e.target.value); setPage(1); }}>
          <option value="">Tất cả trạng thái</option>
          <option value="true">Đã xuất bản</option>
          <option value="false">Nháp</option>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-zinc-700"><Spinner /> Đang tải...</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl bg-white p-6 text-sm text-zinc-600 shadow-sm">Không có dữ liệu.</div>
      ) : (
        <div className="space-y-3">
          <Table headers={["Tiêu đề", "Danh mục", "Trạng thái", "Ngày tạo", "Hành động"]}>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-zinc-100">
                <td className="px-3 py-2 text-sm text-zinc-700">{item.title}</td>
                <td className="px-3 py-2 text-sm text-zinc-700">{categoryLabel(item.category)}</td>
                <td className="px-3 py-2 text-sm text-zinc-700">{item.isPublished ? "Đã xuất bản" : "Nháp"}</td>
                <td className="px-3 py-2 text-sm text-zinc-700">{formatDateVi(item.createdAt)}</td>
                <td className="px-3 py-2">
                  <Button
                    variant="secondary"
                    className="h-7 px-2 py-1 text-xs"
                    onClick={() => {
                      setEditing(item);
                      setForm({
                        category: item.category,
                        title: item.title,
                        body: item.body,
                        isPublished: item.isPublished,
                      });
                      setOpenForm(true);
                    }}
                  >
                    Sửa
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        </div>
      )}

      <Modal open={openForm} title={editing ? "Cập nhật nội dung" : "Tạo nội dung"} onClose={() => setOpenForm(false)}>
        <div className="space-y-3">
          <Select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as Item["category"] }))}>
            <option value="HUONG_DAN">Hướng dẫn</option>
            <option value="MEO_HOC">Mẹo học</option>
            <option value="HO_SO">Hồ sơ</option>
            <option value="THI">Thi</option>
          </Select>
          <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Tiêu đề" />
          <textarea
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            rows={8}
            value={form.body}
            onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
            placeholder="Nội dung"
          />
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm((p) => ({ ...p, isPublished: e.target.checked }))} />
            Xuất bản
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenForm(false)}>Hủy</Button>
            <Button onClick={save}>Lưu</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
