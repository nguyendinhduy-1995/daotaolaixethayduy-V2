"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, fetchMe, getToken } from "@/lib/auth-client";
import { firstDayOfMonthYmd, shiftDateYmd, todayInHoChiMinh } from "@/lib/date-utils";
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
import { hasUiPermission } from "@/lib/ui-permissions";

type ReceiptMethodFilter = "" | "cash" | "bank" | "momo" | "other";
type ReceiptMethodInput = "cash" | "bank" | "momo" | "other";

type ReceiptItem = {
  id: string;
  studentId: string;
  amount: number;
  method: "cash" | "bank_transfer" | "card" | "other";
  note: string | null;
  receivedAt: string;
  createdAt: string;
  student?: {
    id: string;
    lead?: {
      id: string;
      fullName: string | null;
      phone: string | null;
    } | null;
  } | null;
};

type ReceiptListResponse = {
  items: ReceiptItem[];
  page: number;
  pageSize: number;
  total: number;
};

type ReceiptSummaryResponse = {
  date: string;
  totalThu: number;
  totalPhieuThu: number;
};

type StudentOption = {
  id: string;
  lead: {
    id: string;
    fullName: string | null;
    phone: string | null;
    status: string;
  };
};

type StudentListResponse = {
  items: StudentOption[];
};

type FormState = {
  studentId: string;
  amount: string;
  method: ReceiptMethodInput;
  receivedAt: string;
  note: string;
};

const EMPTY_FORM: FormState = {
  studentId: "",
  amount: "",
  method: "cash",
  receivedAt: todayInHoChiMinh(),
  note: "",
};

function formatMethod(value: ReceiptItem["method"]) {
  if (value === "cash") return "Tiền mặt";
  if (value === "bank_transfer") return "Chuyển khoản";
  if (value === "card") return "Thẻ";
  return "Momo/Khác";
}

function parseApiError(error: ApiClientError) {
  return `${error.code}: ${error.message}`;
}

export default function ReceiptsPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"day" | "range">("day");
  const [date, setDate] = useState(todayInHoChiMinh());
  const [from, setFrom] = useState(todayInHoChiMinh());
  const [to, setTo] = useState(todayInHoChiMinh());
  const [method, setMethod] = useState<ReceiptMethodFilter>("");
  const [q, setQ] = useState("");
  const [studentId, setStudentId] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<ReceiptSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentQuery, setStudentQuery] = useState("");
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([]);

  const [modalStudentQuery, setModalStudentQuery] = useState("");
  const [modalStudentOptions, setModalStudentOptions] = useState<StudentOption[]>([]);
  const [modalStudentsLoading, setModalStudentsLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [canCreateReceipt, setCanCreateReceipt] = useState(false);
  const [createForm, setCreateForm] = useState<FormState>(EMPTY_FORM);

  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);

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

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (mode === "day") params.set("date", date);
    if (mode === "range") {
      params.set("from", from);
      params.set("to", to);
    }
    if (method) params.set("method", method);
    if (q.trim()) params.set("q", q.trim());
    if (studentId) params.set("studentId", studentId);
    return params.toString();
  }, [date, from, method, mode, page, pageSize, q, studentId, to]);

  const fetchStudentsForFilter = useCallback(
    async (keyword: string) => {
      const token = getToken();
      if (!token) return;
      setStudentsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("pageSize", "20");
        if (keyword.trim()) params.set("q", keyword.trim());
        const data = await fetchJson<StudentListResponse>(`/api/students?${params.toString()}`, { token });
        setStudentOptions(data.items);
      } catch (e) {
        const err = e as ApiClientError;
        if (!handleAuthError(err)) setError(`Có lỗi xảy ra: ${parseApiError(err)}`);
      } finally {
        setStudentsLoading(false);
      }
    },
    [handleAuthError]
  );

  const fetchStudentsForModal = useCallback(
    async (keyword: string) => {
      const token = getToken();
      if (!token) return;
      setModalStudentsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("pageSize", "20");
        if (keyword.trim()) params.set("q", keyword.trim());
        const data = await fetchJson<StudentListResponse>(`/api/students?${params.toString()}`, { token });
        setModalStudentOptions(data.items);
      } catch (e) {
        const err = e as ApiClientError;
        if (!handleAuthError(err)) setError(`Có lỗi xảy ra: ${parseApiError(err)}`);
      } finally {
        setModalStudentsLoading(false);
      }
    },
    [handleAuthError]
  );

  const loadReceipts = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const list = await fetchJson<ReceiptListResponse>(`/api/receipts?${queryString}`, { token });
      setItems(list.items);
      setTotal(list.total);

      if (mode === "day") {
        const daily = await fetchJson<ReceiptSummaryResponse>(`/api/receipts/summary?date=${date}`, { token });
        setSummary(daily);
      } else {
        setSummary(null);
      }
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`Có lỗi xảy ra: ${parseApiError(err)}`);
    } finally {
      setLoading(false);
    }
  }, [date, handleAuthError, mode, queryString]);

  useEffect(() => {
    loadReceipts();
  }, [loadReceipts]);

  useEffect(() => {
    fetchMe()
      .then((data) => setCanCreateReceipt(hasUiPermission(data.user.permissions, "receipts", "CREATE")))
      .catch(() => setCanCreateReceipt(false));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStudentsForFilter(studentQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchStudentsForFilter, studentQuery]);

  useEffect(() => {
    if (!createOpen) return;
    const timer = setTimeout(() => {
      fetchStudentsForModal(modalStudentQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchStudentsForModal, modalStudentQuery, createOpen]);

  useEffect(() => {
    if (createOpen) {
      setModalStudentQuery("");
      fetchStudentsForModal("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createOpen]);

  async function submitCreate() {
    const token = getToken();
    if (!token) return;
    if (!createForm.studentId) {
      setError("VALIDATION_ERROR: Vui lòng chọn học viên");
      return;
    }
    const amount = Number(createForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("VALIDATION_ERROR: Số tiền phải lớn hơn 0");
      return;
    }

    setCreateSaving(true);
    setError("");
    try {
      await fetchJson<{ receipt: ReceiptItem }>("/api/receipts", {
        method: "POST",
        token,
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: {
          studentId: createForm.studentId,
          amount: Math.round(amount),
          method: createForm.method,
          receivedAt: createForm.receivedAt,
          note: createForm.note || undefined,
        },
      });
      setCreateOpen(false);
      setCreateForm({ ...EMPTY_FORM, receivedAt: mode === "day" ? date : todayInHoChiMinh() });
      await loadReceipts();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`Có lỗi xảy ra: ${parseApiError(err)}`);
    } finally {
      setCreateSaving(false);
    }
  }

  async function submitEdit() {
    const token = getToken();
    if (!token) return;
    const amount = Number(editForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("VALIDATION_ERROR: Số tiền phải lớn hơn 0");
      return;
    }

    setEditSaving(true);
    setError("");
    try {
      await fetchJson<{ receipt: ReceiptItem }>(`/api/receipts/${editingId}`, {
        method: "PATCH",
        token,
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: {
          amount: Math.round(amount),
          method: editForm.method,
          receivedAt: editForm.receivedAt,
          note: editForm.note || undefined,
        },
      });
      setEditOpen(false);
      await loadReceipts();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`Có lỗi xảy ra: ${parseApiError(err)}`);
    } finally {
      setEditSaving(false);
    }
  }

  function openEdit(item: ReceiptItem) {
    const methodValue: ReceiptMethodInput =
      item.method === "cash"
        ? "cash"
        : item.method === "bank_transfer"
          ? "bank"
          : item.method === "other"
            ? "momo"
            : "other";

    setEditingId(item.id);
    setEditForm({
      studentId: item.studentId,
      amount: String(item.amount),
      method: methodValue,
      receivedAt: item.receivedAt.slice(0, 10),
      note: item.note || "",
    });
    setEditOpen(true);
  }

  function applyPreset(preset: "today" | "yesterday" | "last7" | "thisMonth") {
    const today = todayInHoChiMinh();
    if (preset === "today") {
      setMode("day");
      setDate(today);
      return;
    }
    if (preset === "yesterday") {
      setMode("day");
      setDate(shiftDateYmd(today, -1));
      return;
    }
    if (preset === "last7") {
      setMode("range");
      setFrom(shiftDateYmd(today, -6));
      setTo(today);
      return;
    }
    setMode("range");
    setFrom(firstDayOfMonthYmd(today));
    setTo(today);
  }

  return (
    <div className="space-y-4">
      {/* ── Premium Header ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 p-4 text-white shadow-lg shadow-emerald-200 animate-fadeInUp">
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/10 blur-xl" />
        <div className="relative flex flex-wrap items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-2xl backdrop-blur-sm">🧾</div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">Phiếu thu</h2>
            <p className="text-sm text-white/80">Quản lý phiếu thu học phí</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-sm font-bold backdrop-blur-sm">📊 {total}</span>
            <Button variant="secondary" onClick={loadReceipts} disabled={loading} className="!bg-white/20 !text-white !border-white/30 hover:!bg-white/30">
              {loading ? "Đang tải..." : "Làm mới"}
            </Button>
            {canCreateReceipt ? (
              <Button onClick={() => { setCreateForm({ ...EMPTY_FORM, receivedAt: mode === "day" ? date : todayInHoChiMinh(), studentId }); setCreateOpen(true); }} className="!bg-white/20 !text-white !border-white/30 hover:!bg-white/30">
                ➕ Tạo phiếu thu
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {error ? <Alert type="error" message={error} /> : null}

      {/* ── Filter Section ── */}
      <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm animate-fadeInUp" style={{ animationDelay: "80ms" }}>
        <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
        <div className="space-y-3 p-4">
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm text-zinc-600">Chế độ</label>
              <Select
                value={mode}
                onChange={(e) => {
                  setPage(1);
                  setMode(e.target.value as "day" | "range");
                }}
              >
                <option value="day">Theo ngày</option>
                <option value="range">Theo khoảng</option>
              </Select>
            </div>

            {mode === "day" ? (
              <div>
                <label className="mb-1 block text-sm text-zinc-600">Ngày</label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setPage(1);
                    setDate(e.target.value);
                  }}
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-sm text-zinc-600">Từ ngày</label>
                  <Input
                    type="date"
                    value={from}
                    onChange={(e) => {
                      setPage(1);
                      setFrom(e.target.value);
                    }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-zinc-600">Đến ngày</label>
                  <Input
                    type="date"
                    value={to}
                    onChange={(e) => {
                      setPage(1);
                      setTo(e.target.value);
                    }}
                  />
                </div>
              </>
            )}

            <div>
              <label className="mb-1 block text-sm text-zinc-600">Phương thức</label>
              <Select
                value={method}
                onChange={(e) => {
                  setPage(1);
                  setMethod(e.target.value as ReceiptMethodFilter);
                }}
              >
                <option value="">Tất cả</option>
                <option value="cash">Tiền mặt</option>
                <option value="bank">Chuyển khoản</option>
                <option value="momo">Momo</option>
                <option value="other">Khác</option>
              </Select>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
            <Input
              placeholder="Tìm tên học viên/SĐT"
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
            />

            <Select
              value={studentId}
              onChange={(e) => {
                setPage(1);
                setStudentId(e.target.value);
              }}
            >
              <option value="">Tất cả học viên</option>
              {studentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.lead.fullName || "Không tên"} - {option.lead.phone || "Không SĐT"}
                </option>
              ))}
            </Select>

            <Input
              placeholder="Tìm học viên để lọc..."
              value={studentQuery}
              onChange={(e) => setStudentQuery(e.target.value)}
            />

            <Select
              value={String(pageSize)}
              onChange={(e) => {
                setPage(1);
                setPageSize(Number(e.target.value));
              }}
            >
              <option value="20">20 / trang</option>
              <option value="50">50 / trang</option>
              <option value="100">100 / trang</option>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => applyPreset("today")}>
              Hôm nay
            </Button>
            <Button variant="secondary" onClick={() => applyPreset("yesterday")}>
              Hôm qua
            </Button>
            <Button variant="secondary" onClick={() => applyPreset("last7")}>
              7 ngày gần nhất
            </Button>
            <Button variant="secondary" onClick={() => applyPreset("thisMonth")}>
              Tháng này
            </Button>
            {studentsLoading ? (
              <span className="inline-flex items-center gap-2 text-sm text-zinc-500">
                <Spinner /> Đang tải học viên...
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {mode === "day" && summary ? (
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-2 text-sm text-zinc-600">Tổng quan ngày {summary.date}</div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 p-3">
              <p className="text-sm text-zinc-500">Tổng thu trong ngày</p>
              <p className="text-2xl font-semibold text-zinc-900">{formatCurrencyVnd(summary.totalThu)}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <p className="text-sm text-zinc-500">Số phiếu thu</p>
              <p className="text-2xl font-semibold text-zinc-900">{summary.totalPhieuThu}</p>
            </div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
              <div className="h-8 w-8 rounded-lg bg-zinc-200" />
              <div className="flex-1 space-y-2"><div className="h-4 w-1/4 rounded bg-zinc-200" /><div className="h-3 w-1/3 rounded bg-zinc-100" /></div>
              <div className="h-6 w-20 rounded-full bg-zinc-200" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-white p-8 text-center animate-fadeInUp">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-2xl">📭</div>
          <p className="font-medium text-zinc-700">Không có dữ liệu</p>
          <p className="mt-1 text-sm text-zinc-500">Không tìm thấy phiếu thu phù hợp bộ lọc.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm animate-fadeInUp" style={{ animationDelay: "160ms" }}>
          <Table headers={["Ngày thu", "Học viên", "Số tiền", "Phương thức", "Ghi chú", "Hành động"]}>
            {items.map((item, idx) => (
              <tr key={item.id} className="border-t border-zinc-100 transition-colors hover:bg-zinc-50 animate-fadeInUp" style={{ animationDelay: `${160 + Math.min(idx * 40, 300)}ms` }}>
                <td className="px-3 py-2 text-sm text-zinc-700">{formatDateTimeVi(item.receivedAt)}</td>
                <td className="px-3 py-2">
                  <div className="font-medium text-zinc-900">{item.student?.lead?.fullName || "Không rõ"}</div>
                  <div className="text-xs text-zinc-500">{item.student?.lead?.phone || "-"}</div>
                </td>
                <td className="px-3 py-2 font-medium text-zinc-900">{formatCurrencyVnd(item.amount)}</td>
                <td className="px-3 py-2">
                  <Badge text={formatMethod(item.method)} />
                </td>
                <td className="px-3 py-2 text-sm text-zinc-700">{item.note || "-"}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <Link
                      href={`/students/${item.studentId}?tab=receipts`}
                      className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                    >
                      Xem
                    </Link>
                    <Button variant="secondary" className="h-7 px-2 py-1 text-xs" onClick={() => openEdit(item)}>
                      Sửa
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />

      <Modal open={createOpen} title="Tạo phiếu thu" onClose={() => setCreateOpen(false)}>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Tìm học viên</label>
            <Input value={modalStudentQuery} onChange={(e) => setModalStudentQuery(e.target.value)} placeholder="Nhập tên hoặc SĐT" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">
              Học viên {modalStudentsLoading ? <span className="text-xs text-zinc-400">(đang tải...)</span> : <span className="text-xs text-zinc-400">({modalStudentOptions.length} kết quả)</span>}
            </label>
            <Select value={createForm.studentId} onChange={(e) => setCreateForm((s) => ({ ...s, studentId: e.target.value }))}>
              <option value="">Chọn học viên</option>
              {modalStudentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.lead.fullName || "Không tên"} - {option.lead.phone || "Không SĐT"}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-zinc-600">Số tiền</label>
              <Input
                type="number"
                min={1}
                value={createForm.amount}
                onChange={(e) => setCreateForm((s) => ({ ...s, amount: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-600">Phương thức</label>
              <Select
                value={createForm.method}
                onChange={(e) => setCreateForm((s) => ({ ...s, method: e.target.value as ReceiptMethodInput }))}
              >
                <option value="cash">Tiền mặt</option>
                <option value="bank">Chuyển khoản</option>
                <option value="momo">Momo</option>
                <option value="other">Khác</option>
              </Select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Ngày thu</label>
            <Input
              type="date"
              value={createForm.receivedAt}
              onChange={(e) => setCreateForm((s) => ({ ...s, receivedAt: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Ghi chú</label>
            <Input value={createForm.note} onChange={(e) => setCreateForm((s) => ({ ...s, note: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Huỷ
            </Button>
            <Button onClick={submitCreate} disabled={createSaving}>
              {createSaving ? "Đang lưu..." : "Lưu"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={editOpen} title="Sửa phiếu thu" onClose={() => setEditOpen(false)}>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Số tiền</label>
            <Input
              type="number"
              min={1}
              value={editForm.amount}
              onChange={(e) => setEditForm((s) => ({ ...s, amount: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Phương thức</label>
            <Select
              value={editForm.method}
              onChange={(e) => setEditForm((s) => ({ ...s, method: e.target.value as ReceiptMethodInput }))}
            >
              <option value="cash">Tiền mặt</option>
              <option value="bank">Chuyển khoản</option>
              <option value="momo">Momo</option>
              <option value="other">Khác</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Ngày thu</label>
            <Input
              type="date"
              value={editForm.receivedAt}
              onChange={(e) => setEditForm((s) => ({ ...s, receivedAt: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Ghi chú</label>
            <Input value={editForm.note} onChange={(e) => setEditForm((s) => ({ ...s, note: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(false)}>
              Huỷ
            </Button>
            <Button onClick={submitEdit} disabled={editSaving}>
              {editSaving ? "Đang lưu..." : "Lưu"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
