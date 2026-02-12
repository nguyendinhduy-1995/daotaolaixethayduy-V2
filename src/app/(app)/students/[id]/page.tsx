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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function formatMethod(value: ReceiptItem["method"]) {
  if (value === "cash") return "Tien mat";
  if (value === "bank_transfer") return "Chuyen khoan";
  if (value === "card") return "The";
  return "Momo/Khac";
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
      if (!handleAuthError(err)) setError(`Co loi xay ra: ${err.code}: ${err.message}`);
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
      if (!handleAuthError(err)) setError(`Co loi xay ra: ${err.code}: ${err.message}`);
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
      setError("VALIDATION_ERROR: So tien phai lon hon 0");
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
      if (!handleAuthError(err)) setError(`Co loi xay ra: ${err.code}: ${err.message}`);
    } finally {
      setCreateSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-zinc-700">
        <Spinner /> Dang tai...
      </div>
    );
  }

  if (!student) {
    return <Alert type="error" message={error || "Khong tim thay hoc vien"} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">{student.lead.fullName || "Hoc vien"}</h1>
          <p className="text-sm text-zinc-500">{student.lead.phone || "Khong co SDT"}</p>
        </div>
        <Link href="/receipts" className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700">
          Quay lai
        </Link>
      </div>

      {error ? <Alert type="error" message={error} /> : null}

      <div className="flex gap-2">
        <Button variant={tab === "overview" ? "primary" : "secondary"} onClick={() => setTab("overview")}>
          Tong quan
        </Button>
        <Button variant={tab === "receipts" ? "primary" : "secondary"} onClick={() => setTab("receipts")}>
          Thu tien
        </Button>
      </div>

      {tab === "overview" ? (
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-sm text-zinc-500">Trang thai lead</p>
              <Badge text={student.lead.status} />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Trang thai hoc</p>
              <Badge text={student.studyStatus} />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Khoa hoc</p>
              <p className="text-zinc-900">{student.course?.code || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Hoc phi</p>
              <p className="text-zinc-900">
                {student.tuitionSnapshot !== null ? `${formatCurrency(student.tuitionSnapshot)} VND` : "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Ngay tao</p>
              <p className="text-zinc-900">{new Date(student.createdAt).toLocaleString("vi-VN")}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Cap nhat</p>
              <p className="text-zinc-900">{new Date(student.updatedAt).toLocaleString("vi-VN")}</p>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "receipts" ? (
        <div className="space-y-4 rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-sm text-zinc-600">
              Da thu tren trang nay: <span className="font-semibold text-zinc-900">{formatCurrency(totalCollected)} VND</span>
            </div>
            <Button onClick={() => setCreateOpen(true)}>Tao phieu thu</Button>
          </div>

          {receiptLoading ? (
            <div className="text-sm text-zinc-600">Dang tai...</div>
          ) : receiptItems.length === 0 ? (
            <div className="rounded-lg bg-zinc-50 p-4 text-sm text-zinc-600">Khong co du lieu</div>
          ) : (
            <Table headers={["Ngay thu", "So tien", "Phuong thuc", "Ghi chu"]}>
              {receiptItems.map((item) => (
                <tr key={item.id} className="border-t border-zinc-100">
                  <td className="px-3 py-2 text-sm text-zinc-700">{new Date(item.receivedAt).toLocaleString("vi-VN")}</td>
                  <td className="px-3 py-2 font-medium text-zinc-900">{formatCurrency(item.amount)} VND</td>
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

      <Modal open={createOpen} title="Tao phieu thu" onClose={() => setCreateOpen(false)}>
        <div className="space-y-3">
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
              onChange={(e) => setCreateForm((s) => ({ ...s, method: e.target.value as FormState["method"] }))}
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
            <Button onClick={createReceipt} disabled={createSaving}>
              {createSaving ? "Dang luu..." : "Luu"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
