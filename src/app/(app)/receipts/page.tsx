"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, getToken } from "@/lib/auth-client";
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function formatMethod(value: ReceiptItem["method"]) {
  if (value === "cash") return "Tien mat";
  if (value === "bank_transfer") return "Chuyen khoan";
  if (value === "card") return "The";
  return "Momo/Khac";
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

  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
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

  const fetchStudents = useCallback(
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
        if (!handleAuthError(err)) setError(`Co loi xay ra: ${parseApiError(err)}`);
      } finally {
        setStudentsLoading(false);
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
      if (!handleAuthError(err)) setError(`Co loi xay ra: ${parseApiError(err)}`);
    } finally {
      setLoading(false);
    }
  }, [date, handleAuthError, mode, queryString]);

  useEffect(() => {
    loadReceipts();
  }, [loadReceipts]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStudents(studentQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchStudents, studentQuery]);

  async function submitCreate() {
    const token = getToken();
    if (!token) return;
    if (!createForm.studentId) {
      setError("VALIDATION_ERROR: Vui long chon hoc vien");
      return;
    }
    const amount = Number(createForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("VALIDATION_ERROR: So tien phai lon hon 0");
      return;
    }

    setCreateSaving(true);
    setError("");
    try {
      await fetchJson<{ receipt: ReceiptItem }>("/api/receipts", {
        method: "POST",
        token,
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
      if (!handleAuthError(err)) setError(`Co loi xay ra: ${parseApiError(err)}`);
    } finally {
      setCreateSaving(false);
    }
  }

  async function submitEdit() {
    const token = getToken();
    if (!token) return;
    const amount = Number(editForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("VALIDATION_ERROR: So tien phai lon hon 0");
      return;
    }

    setEditSaving(true);
    setError("");
    try {
      await fetchJson<{ receipt: ReceiptItem }>(`/api/receipts/${editingId}`, {
        method: "PATCH",
        token,
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
      if (!handleAuthError(err)) setError(`Co loi xay ra: ${parseApiError(err)}`);
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-900">Phieu thu</h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={loadReceipts} disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <Spinner /> Dang tai...
              </span>
            ) : (
              "Lam moi"
            )}
          </Button>
          <Button
            onClick={() => {
              setCreateForm({ ...EMPTY_FORM, receivedAt: mode === "day" ? date : todayInHoChiMinh(), studentId });
              setCreateOpen(true);
            }}
          >
            Tao phieu thu
          </Button>
        </div>
      </div>

      {error ? <Alert type="error" message={error} /> : null}

      <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Che do</label>
            <Select
              value={mode}
              onChange={(e) => {
                setPage(1);
                setMode(e.target.value as "day" | "range");
              }}
            >
              <option value="day">Theo ngay</option>
              <option value="range">Theo khoang</option>
            </Select>
          </div>

          {mode === "day" ? (
            <div>
              <label className="mb-1 block text-sm text-zinc-600">Ngay</label>
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
                <label className="mb-1 block text-sm text-zinc-600">Tu ngay</label>
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
                <label className="mb-1 block text-sm text-zinc-600">Den ngay</label>
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
            <label className="mb-1 block text-sm text-zinc-600">Phuong thuc</label>
            <Select
              value={method}
              onChange={(e) => {
                setPage(1);
                setMethod(e.target.value as ReceiptMethodFilter);
              }}
            >
              <option value="">Tat ca</option>
              <option value="cash">Tien mat</option>
              <option value="bank">Chuyen khoan</option>
              <option value="momo">Momo</option>
              <option value="other">Khac</option>
            </Select>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
          <Input
            placeholder="Tim ten hoc vien/SDT"
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
            <option value="">Tat ca hoc vien</option>
            {studentOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.lead.fullName || "Khong ten"} - {option.lead.phone || "Khong SDT"}
              </option>
            ))}
          </Select>

          <Input
            placeholder="Tim hoc vien de loc..."
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
            Hom nay
          </Button>
          <Button variant="secondary" onClick={() => applyPreset("yesterday")}>
            Hom qua
          </Button>
          <Button variant="secondary" onClick={() => applyPreset("last7")}>
            7 ngay gan nhat
          </Button>
          <Button variant="secondary" onClick={() => applyPreset("thisMonth")}>
            Thang nay
          </Button>
          {studentsLoading ? (
            <span className="inline-flex items-center gap-2 text-sm text-zinc-500">
              <Spinner /> Dang tai hoc vien...
            </span>
          ) : null}
        </div>
      </div>

      {mode === "day" && summary ? (
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-2 text-sm text-zinc-600">Tong quan ngay {summary.date}</div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 p-3">
              <p className="text-sm text-zinc-500">Tong thu trong ngay</p>
              <p className="text-2xl font-semibold text-zinc-900">{formatCurrency(summary.totalThu)} VND</p>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <p className="text-sm text-zinc-500">So phieu thu</p>
              <p className="text-2xl font-semibold text-zinc-900">{summary.totalPhieuThu}</p>
            </div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl bg-white p-6 text-sm text-zinc-600">Dang tai...</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl bg-white p-6 text-sm text-zinc-600">Khong co du lieu</div>
      ) : (
        <Table headers={["Ngay thu", "Hoc vien", "So tien", "Phuong thuc", "Ghi chu", "Hanh dong"]}>
          {items.map((item) => (
            <tr key={item.id} className="border-t border-zinc-100">
              <td className="px-3 py-2 text-sm text-zinc-700">{new Date(item.receivedAt).toLocaleString("vi-VN")}</td>
              <td className="px-3 py-2">
                <div className="font-medium text-zinc-900">{item.student?.lead?.fullName || "Khong ro"}</div>
                <div className="text-xs text-zinc-500">{item.student?.lead?.phone || "-"}</div>
              </td>
              <td className="px-3 py-2 font-medium text-zinc-900">{formatCurrency(item.amount)} VND</td>
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
                    Sua
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />

      <Modal open={createOpen} title="Tao phieu thu" onClose={() => setCreateOpen(false)}>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Tim hoc vien</label>
            <Input value={studentQuery} onChange={(e) => setStudentQuery(e.target.value)} placeholder="Nhap ten hoac SDT" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Hoc vien</label>
            <Select value={createForm.studentId} onChange={(e) => setCreateForm((s) => ({ ...s, studentId: e.target.value }))}>
              <option value="">Chon hoc vien</option>
              {studentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.lead.fullName || "Khong ten"} - {option.lead.phone || "Khong SDT"}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-zinc-600">So tien</label>
              <Input
                type="number"
                min={1}
                value={createForm.amount}
                onChange={(e) => setCreateForm((s) => ({ ...s, amount: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-600">Phuong thuc</label>
              <Select
                value={createForm.method}
                onChange={(e) => setCreateForm((s) => ({ ...s, method: e.target.value as ReceiptMethodInput }))}
              >
                <option value="cash">Tien mat</option>
                <option value="bank">Chuyen khoan</option>
                <option value="momo">Momo</option>
                <option value="other">Khac</option>
              </Select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Ngay thu</label>
            <Input
              type="date"
              value={createForm.receivedAt}
              onChange={(e) => setCreateForm((s) => ({ ...s, receivedAt: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Ghi chu</label>
            <Input value={createForm.note} onChange={(e) => setCreateForm((s) => ({ ...s, note: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Huy
            </Button>
            <Button onClick={submitCreate} disabled={createSaving}>
              {createSaving ? "Dang luu..." : "Luu"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={editOpen} title="Sua phieu thu" onClose={() => setEditOpen(false)}>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-zinc-600">So tien</label>
            <Input
              type="number"
              min={1}
              value={editForm.amount}
              onChange={(e) => setEditForm((s) => ({ ...s, amount: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Phuong thuc</label>
            <Select
              value={editForm.method}
              onChange={(e) => setEditForm((s) => ({ ...s, method: e.target.value as ReceiptMethodInput }))}
            >
              <option value="cash">Tien mat</option>
              <option value="bank">Chuyen khoan</option>
              <option value="momo">Momo</option>
              <option value="other">Khac</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Ngay thu</label>
            <Input
              type="date"
              value={editForm.receivedAt}
              onChange={(e) => setEditForm((s) => ({ ...s, receivedAt: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Ghi chu</label>
            <Input value={editForm.note} onChange={(e) => setEditForm((s) => ({ ...s, note: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(false)}>
              Huy
            </Button>
            <Button onClick={submitEdit} disabled={editSaving}>
              {editSaving ? "Dang luu..." : "Luu"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
