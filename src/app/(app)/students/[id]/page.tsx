"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, getToken } from "@/lib/auth-client";
import { todayInHoChiMinh } from "@/lib/date-utils";
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

type StudentDetail = {
  id: string;
  leadId: string;
  courseId: string | null;
  tuitionPlanId: string | null;
  tuitionSnapshot: number | null;
  studyStatus: string;
  examStatus: string | null;
  examResult: string | null;
  createdAt: string;
  updatedAt: string;
  lead: {
    id: string;
    fullName: string | null;
    phone: string | null;
    status: string;
  };
  course: { id: string; code: string } | null;
  tuitionPlan: {
    id: string;
    province: string;
    licenseType: string;
    tuition: number;
  } | null;
};

type ReceiptItem = {
  id: string;
  studentId: string;
  amount: number;
  method: "cash" | "bank_transfer" | "card" | "other";
  note: string | null;
  receivedAt: string;
};

type ReceiptListResponse = {
  items: ReceiptItem[];
  page: number;
  pageSize: number;
  total: number;
};

type FormState = {
  amount: string;
  method: "cash" | "bank" | "momo" | "other";
  receivedAt: string;
  note: string;
};

function formatMethod(value: ReceiptItem["method"]) {
  if (value === "cash") return "Tiền mặt";
  if (value === "bank_transfer") return "Chuyển khoản";
  if (value === "card") return "Thẻ";
  return "Momo/Khác";
}

function studyStatusLabel(value: string) {
  if (value === "studying") return "Đang học";
  if (value === "paused") return "Tạm dừng";
  if (value === "done") return "Hoàn thành";
  return value;
}

export default function StudentDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [tab, setTab] = useState<"overview" | "receipts">(
    searchParams.get("tab") === "receipts" ? "receipts" : "overview"
  );
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([]);
  const [receiptPage, setReceiptPage] = useState(1);
  const [receiptPageSize] = useState(20);
  const [receiptTotal, setReceiptTotal] = useState(0);
  const [receiptLoading, setReceiptLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createForm, setCreateForm] = useState<FormState>({
    amount: "",
    method: "cash",
    receivedAt: todayInHoChiMinh(),
    note: "",
  });

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

  const studentId = params.id;

  const totalCollected = useMemo(
    () => receiptItems.reduce((sum, item) => sum + item.amount, 0),
    [receiptItems]
  );

  const loadStudent = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson<{ student: StudentDetail }>(`/api/students/${studentId}`, { token });
      setStudent(data.student);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`Có lỗi xảy ra: ${err.code}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [handleAuthError, studentId]);

  const loadReceipts = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setReceiptLoading(true);
    setError("");
    try {
      const paramsText = new URLSearchParams({
        studentId,
        page: String(receiptPage),
        pageSize: String(receiptPageSize),
      });
      const data = await fetchJson<ReceiptListResponse>(`/api/receipts?${paramsText.toString()}`, { token });
      setReceiptItems(data.items);
      setReceiptTotal(data.total);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`Có lỗi xảy ra: ${err.code}: ${err.message}`);
    } finally {
      setReceiptLoading(false);
    }
  }, [handleAuthError, receiptPage, receiptPageSize, studentId]);

  useEffect(() => {
    loadStudent();
  }, [loadStudent]);

  useEffect(() => {
    if (tab !== "receipts") return;
    loadReceipts();
  }, [loadReceipts, tab]);

  async function createReceipt() {
    const token = getToken();
    if (!token) return;
    const amount = Number(createForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("VALIDATION_ERROR: Số tiền phải lớn hơn 0");
      return;
    }

    setCreateSaving(true);
    setError("");
    try {
      await fetchJson("/api/receipts", {
        method: "POST",
        token,
        body: {
          studentId,
          amount: Math.round(amount),
          method: createForm.method,
          receivedAt: createForm.receivedAt,
          note: createForm.note || undefined,
        },
      });
      setCreateOpen(false);
      setCreateForm({ amount: "", method: "cash", receivedAt: todayInHoChiMinh(), note: "" });
      await loadReceipts();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`Có lỗi xảy ra: ${err.code}: ${err.message}`);
    } finally {
      setCreateSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-zinc-700">
        <Spinner /> Đang tải...
      </div>
    );
  }

  if (!student) {
    return <Alert type="error" message={error || "Không tìm thấy học viên"} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">{student.lead.fullName || "Học viên"}</h1>
          <p className="text-sm text-zinc-500">{student.lead.phone || "Không có SĐT"}</p>
        </div>
        <Link href="/receipts" className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700">
          Quay lại
        </Link>
      </div>

      {error ? <Alert type="error" message={error} /> : null}

      <div className="flex gap-2">
        <Button variant={tab === "overview" ? "primary" : "secondary"} onClick={() => setTab("overview")}>
          Tổng quan
        </Button>
        <Button variant={tab === "receipts" ? "primary" : "secondary"} onClick={() => setTab("receipts")}>
          Thu tiền
        </Button>
      </div>

      {tab === "overview" ? (
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-sm text-zinc-500">Trạng thái khách hàng</p>
              <Badge text={student.lead.status} />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Trạng thái học</p>
              <Badge text={studyStatusLabel(student.studyStatus)} />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Khóa học</p>
              <p className="text-zinc-900">{student.course?.code || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Học phí</p>
              <p className="text-zinc-900">
                {student.tuitionSnapshot !== null ? formatCurrencyVnd(student.tuitionSnapshot) : "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Ngày tạo</p>
              <p className="text-zinc-900">{formatDateTimeVi(student.createdAt)}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Cập nhật</p>
              <p className="text-zinc-900">{formatDateTimeVi(student.updatedAt)}</p>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "receipts" ? (
        <div className="space-y-4 rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-sm text-zinc-600">
              Đã thu trên trang này: <span className="font-semibold text-zinc-900">{formatCurrencyVnd(totalCollected)}</span>
            </div>
            <Button onClick={() => setCreateOpen(true)}>Tạo phiếu thu</Button>
          </div>

          {receiptLoading ? (
            <div className="text-sm text-zinc-600">Đang tải...</div>
          ) : receiptItems.length === 0 ? (
            <div className="rounded-lg bg-zinc-50 p-4 text-sm text-zinc-600">Không có dữ liệu</div>
          ) : (
            <Table headers={["Ngày thu", "Số tiền", "Phương thức", "Ghi chú"]}>
              {receiptItems.map((item) => (
                <tr key={item.id} className="border-t border-zinc-100">
                  <td className="px-3 py-2 text-sm text-zinc-700">{formatDateTimeVi(item.receivedAt)}</td>
                  <td className="px-3 py-2 font-medium text-zinc-900">{formatCurrencyVnd(item.amount)}</td>
                  <td className="px-3 py-2">
                    <Badge text={formatMethod(item.method)} />
                  </td>
                  <td className="px-3 py-2 text-sm text-zinc-700">{item.note || "-"}</td>
                </tr>
              ))}
            </Table>
          )}

          <Pagination page={receiptPage} pageSize={receiptPageSize} total={receiptTotal} onPageChange={setReceiptPage} />
        </div>
      ) : null}

      <Modal open={createOpen} title="Tạo phiếu thu" onClose={() => setCreateOpen(false)}>
        <div className="space-y-3">
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
              onChange={(e) => setCreateForm((s) => ({ ...s, method: e.target.value as FormState["method"] }))}
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
            <Button onClick={createReceipt} disabled={createSaving}>
              {createSaving ? "Đang lưu..." : "Lưu"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
