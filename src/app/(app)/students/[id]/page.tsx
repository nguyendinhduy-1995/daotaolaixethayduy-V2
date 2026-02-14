"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, fetchMe, getToken } from "@/lib/auth-client";
import { isAdminRole } from "@/lib/admin-auth";
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
    ownerId: string | null;
  };
  course: { id: string; code: string } | null;
  tuitionPlan: {
    id: string;
    province: string;
    licenseType: string;
    tuition: number;
    totalAmount?: number;
    paid50Amount?: number;
    note?: string | null;
    isActive?: boolean;
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

type LeadEvent = {
  id: string;
  leadId: string;
  type: string;
  note?: string | null;
  payload?: unknown;
  createdAt: string;
};

type AutomationLog = {
  id: string;
  leadId: string | null;
  studentId: string | null;
  milestone: string | null;
  status: string;
  sentAt: string;
  payload?: unknown;
};

type TimelineSource = "event" | "receipt" | "automation";
type TimelineFilter = "all" | TimelineSource;
type TimelineItem = {
  id: string;
  source: TimelineSource;
  time: string;
  title: string;
  summary: string;
  badgeMain: string;
  badgeSub?: string;
  raw: unknown;
};

type TuitionPlan = {
  id: string;
  province: string;
  licenseType: "B" | "C1";
  totalAmount: number;
  paid50Amount: number;
  tuition: number;
  isActive: boolean;
};

type TuitionPlansResponse = {
  items: TuitionPlan[];
  page: number;
  pageSize: number;
  total: number;
};

type StudentFinance = {
  tuitionTotal: number;
  paidTotal: number;
  remaining: number;
  paidRatio: number;
  paid50: boolean;
};

function formatMethod(value: ReceiptItem["method"]) {
  if (value === "cash") return "Tiền mặt";
  if (value === "bank_transfer") return "Chuyển khoản";
  if (value === "card") return "Thẻ";
  return "Momo/Khác";
}

function getRuntimeStatus(payload: unknown, fallback: string) {
  if (
    payload &&
    typeof payload === "object" &&
    "runtimeStatus" in payload &&
    typeof (payload as { runtimeStatus?: unknown }).runtimeStatus === "string"
  ) {
    return (payload as { runtimeStatus: string }).runtimeStatus;
  }
  return fallback === "failed" ? "failed" : "success";
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

  const [tab, setTab] = useState<"overview" | "receipts" | "timeline">(
    searchParams.get("tab") === "receipts"
      ? "receipts"
      : searchParams.get("tab") === "timeline"
        ? "timeline"
        : "overview"
  );
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [finance, setFinance] = useState<StudentFinance | null>(null);
  const [financeLoading, setFinanceLoading] = useState(false);

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
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>("all");
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [timelineError, setTimelineError] = useState("");
  const [timelineDetail, setTimelineDetail] = useState<TimelineItem | null>(null);
  const [tuitionProvince, setTuitionProvince] = useState("");
  const [tuitionLicenseType, setTuitionLicenseType] = useState<"B" | "C1">("B");
  const [tuitionPlans, setTuitionPlans] = useState<TuitionPlan[]>([]);
  const [selectedTuitionPlanId, setSelectedTuitionPlanId] = useState("");
  const [tuitionTotalOverride, setTuitionTotalOverride] = useState("");
  const [tuitionSaving, setTuitionSaving] = useState(false);

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
      setTuitionProvince(data.student.tuitionPlan?.province || "");
      setTuitionLicenseType((data.student.tuitionPlan?.licenseType as "B" | "C1") || "B");
      setSelectedTuitionPlanId(data.student.tuitionPlanId || "");
      setTuitionTotalOverride(data.student.tuitionSnapshot !== null ? String(data.student.tuitionSnapshot) : "");
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`Có lỗi xảy ra: ${err.code}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [handleAuthError, studentId]);

  const loadFinance = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setFinanceLoading(true);
    try {
      const data = await fetchJson<StudentFinance>(`/api/students/${studentId}/finance`, { token });
      setFinance(data);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`Có lỗi xảy ra: ${err.code}: ${err.message}`);
    } finally {
      setFinanceLoading(false);
    }
  }, [handleAuthError, studentId]);

  const loadTuitionPlans = useCallback(async () => {
    const token = getToken();
    if (!token || !isAdmin || !tuitionProvince.trim()) {
      setTuitionPlans([]);
      return;
    }
    try {
      const params = new URLSearchParams({
        province: tuitionProvince.trim(),
        licenseType: tuitionLicenseType,
        isActive: "true",
        page: "1",
        pageSize: "100",
      });
      const data = await fetchJson<TuitionPlansResponse>(`/api/tuition-plans?${params.toString()}`, { token });
      setTuitionPlans(data.items);
    } catch {
      setTuitionPlans([]);
    }
  }, [isAdmin, tuitionLicenseType, tuitionProvince]);

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

  const loadTimeline = useCallback(async () => {
    const token = getToken();
    if (!token || !student) return;
    setTimelineLoading(true);
    setTimelineError("");
    try {
      const receiptPromise = fetchJson<ReceiptListResponse>(`/api/receipts?studentId=${student.id}&page=1&pageSize=50`, { token });
      const studentLogsPromise = fetchJson<{ items: AutomationLog[] }>(
        `/api/automation/logs?studentId=${student.id}&page=1&pageSize=50`,
        { token }
      ).catch(() => ({ items: [] }));
      const leadEventsPromise = fetchJson<{ items: LeadEvent[] }>(
        `/api/leads/${student.leadId}/events?page=1&pageSize=50&sort=createdAt&order=desc`,
        { token }
      ).catch(() => ({ items: [] }));
      const leadLogsPromise = fetchJson<{ items: AutomationLog[] }>(
        `/api/automation/logs?leadId=${student.leadId}&page=1&pageSize=50`,
        { token }
      ).catch(() => ({ items: [] }));

      const [receiptData, studentLogs, leadEvents, leadLogs] = await Promise.all([
        receiptPromise,
        studentLogsPromise,
        leadEventsPromise,
        leadLogsPromise,
      ]);

      const eventItems: TimelineItem[] = leadEvents.items.map((event) => ({
        id: `event-${event.id}`,
        source: "event",
        time: event.createdAt,
        title: "Sự kiện khách hàng",
        summary: event.note || `Sự kiện ${event.type}`,
        badgeMain: event.type,
        raw: event,
      }));

      const receiptItems: TimelineItem[] = receiptData.items.map((receipt) => ({
        id: `receipt-${receipt.id}`,
        source: "receipt",
        time: receipt.receivedAt,
        title: "Phiếu thu",
        summary: `${formatCurrencyVnd(receipt.amount)} • ${formatMethod(receipt.method)}`,
        badgeMain: "THU_TIEN",
        badgeSub: formatMethod(receipt.method),
        raw: receipt,
      }));

      const logMap = new Map<string, AutomationLog>();
      [...studentLogs.items, ...leadLogs.items].forEach((log) => {
        logMap.set(log.id, log);
      });
      const automationItems: TimelineItem[] = Array.from(logMap.values()).map((log) => ({
        id: `automation-${log.id}`,
        source: "automation",
        time: log.sentAt,
        title: "Automation",
        summary: `Phạm vi ${log.milestone || "-"} • ${log.status}`,
        badgeMain: log.status.toUpperCase(),
        badgeSub: getRuntimeStatus(log.payload, log.status),
        raw: log,
      }));

      const merged = [...eventItems, ...receiptItems, ...automationItems].sort(
        (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
      );
      setTimelineItems(merged);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setTimelineError(`Có lỗi xảy ra: ${err.code}: ${err.message}`);
    } finally {
      setTimelineLoading(false);
    }
  }, [handleAuthError, student]);

  useEffect(() => {
    fetchMe()
      .then((data) => setIsAdmin(isAdminRole(data.user.role)))
      .catch(() => setIsAdmin(false));
  }, []);

  useEffect(() => {
    loadStudent();
  }, [loadStudent]);

  useEffect(() => {
    loadFinance();
  }, [loadFinance]);

  useEffect(() => {
    if (tab !== "receipts") return;
    loadReceipts();
  }, [loadReceipts, tab]);

  useEffect(() => {
    if (tab !== "timeline") return;
    loadTimeline();
  }, [loadTimeline, tab]);

  useEffect(() => {
    if (!isAdmin) return;
    loadTuitionPlans();
  }, [isAdmin, loadTuitionPlans]);

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
      await loadFinance();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`Có lỗi xảy ra: ${err.code}: ${err.message}`);
    } finally {
      setCreateSaving(false);
    }
  }

  async function applyTuitionPlan() {
    const token = getToken();
    if (!token || !selectedTuitionPlanId) {
      setError("Vui lòng chọn bảng học phí.");
      return;
    }
    setTuitionSaving(true);
    setError("");
    try {
      await fetchJson(`/api/students/${studentId}`, {
        method: "PATCH",
        token,
        body: { tuitionPlanId: selectedTuitionPlanId },
      });
      await loadStudent();
      await loadFinance();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`Có lỗi xảy ra: ${err.code}: ${err.message}`);
    } finally {
      setTuitionSaving(false);
    }
  }

  async function saveTuitionOverride() {
    const token = getToken();
    if (!token) return;
    const tuitionTotal = Number(tuitionTotalOverride);
    if (!Number.isInteger(tuitionTotal) || tuitionTotal < 0) {
      setError("Tổng học phí phải là số nguyên không âm.");
      return;
    }
    setTuitionSaving(true);
    setError("");
    try {
      await fetchJson(`/api/students/${studentId}`, {
        method: "PATCH",
        token,
        body: { tuitionTotal },
      });
      await loadStudent();
      await loadFinance();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`Có lỗi xảy ra: ${err.code}: ${err.message}`);
    } finally {
      setTuitionSaving(false);
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
    if (error.includes("AUTH_FORBIDDEN")) {
      return (
        <div className="space-y-3">
          <Alert type="error" message="Bạn không có quyền truy cập học viên này." />
          <Link href="/leads" className="inline-flex rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700">
            Quay lại danh sách khách hàng
          </Link>
        </div>
      );
    }
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
        <Button variant={tab === "timeline" ? "primary" : "secondary"} onClick={() => setTab("timeline")}>
          Nhật ký
        </Button>
      </div>

      {tab === "overview" ? (
        <div className="space-y-4 rounded-xl bg-white p-4 shadow-sm">
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

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-zinc-900">Tài chính học viên</h3>
              {finance ? (
                <Badge text={finance.paid50 ? "Đã đóng >= 50%" : "Chưa đủ 50%"} />
              ) : null}
            </div>

            {financeLoading ? (
              <div className="flex items-center gap-2 text-sm text-zinc-600">
                <Spinner /> Đang tải tài chính...
              </div>
            ) : finance ? (
              <div className="grid gap-3 md:grid-cols-4">
                <div>
                  <p className="text-xs text-zinc-500">Tổng học phí</p>
                  <p className="font-semibold text-zinc-900">{formatCurrencyVnd(finance.tuitionTotal)}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Đã thu</p>
                  <p className="font-semibold text-zinc-900">{formatCurrencyVnd(finance.paidTotal)}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Còn phải thu</p>
                  <p className="font-semibold text-zinc-900">{formatCurrencyVnd(finance.remaining)}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Tỷ lệ đã thu</p>
                  <p className="font-semibold text-zinc-900">{(finance.paidRatio * 100).toFixed(1)}%</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-600">Không có dữ liệu tài chính</p>
            )}
          </div>

          <div className="rounded-lg border border-zinc-200 p-4">
            <h3 className="mb-3 text-sm font-semibold text-zinc-900">Thiết lập học phí</h3>
            {isAdmin ? (
              <div className="space-y-3">
                <div className="grid gap-2 md:grid-cols-3">
                  <Input
                    placeholder="Tỉnh"
                    value={tuitionProvince}
                    onChange={(e) => setTuitionProvince(e.target.value)}
                  />
                  <Select
                    value={tuitionLicenseType}
                    onChange={(e) => setTuitionLicenseType(e.target.value as "B" | "C1")}
                  >
                    <option value="B">B</option>
                    <option value="C1">C1</option>
                  </Select>
                  <Select
                    value={selectedTuitionPlanId}
                    onChange={(e) => setSelectedTuitionPlanId(e.target.value)}
                  >
                    <option value="">Chọn bảng học phí</option>
                    {tuitionPlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.province} - {plan.licenseType} - {formatCurrencyVnd(plan.totalAmount || plan.tuition)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex justify-end">
                  <Button onClick={applyTuitionPlan} disabled={tuitionSaving}>
                    {tuitionSaving ? "Đang lưu..." : "Áp dụng bảng học phí"}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-600">Bạn không có quyền quản lý bảng học phí.</p>
            )}

            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <Input
                type="number"
                min={0}
                placeholder="Override tổng học phí"
                value={tuitionTotalOverride}
                onChange={(e) => setTuitionTotalOverride(e.target.value)}
              />
              <div className="md:col-span-2 flex justify-end">
                <Button onClick={saveTuitionOverride} disabled={tuitionSaving}>
                  {tuitionSaving ? "Đang lưu..." : "Lưu tổng học phí"}
                </Button>
              </div>
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

      {tab === "timeline" ? (
        <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["all", "Tất cả"],
                ["event", "Sự kiện"],
                ["receipt", "Thu tiền"],
                ["automation", "Automation"],
              ] as Array<[TimelineFilter, string]>
            ).map(([value, label]) => (
              <Button key={value} variant={timelineFilter === value ? "primary" : "secondary"} onClick={() => setTimelineFilter(value)}>
                {label}
              </Button>
            ))}
            <Button variant="secondary" onClick={loadTimeline} disabled={timelineLoading}>
              {timelineLoading ? "Đang tải..." : "Làm mới"}
            </Button>
          </div>

          {timelineError ? <Alert type="error" message={timelineError} /> : null}

          {timelineLoading ? (
            <div className="flex items-center gap-2 text-sm text-zinc-600">
              <Spinner /> Đang tải nhật ký...
            </div>
          ) : timelineItems.filter((item) => timelineFilter === "all" || item.source === timelineFilter).length === 0 ? (
            <div className="rounded-lg bg-zinc-50 p-4 text-sm text-zinc-600">Không có dữ liệu</div>
          ) : (
            <div className="space-y-2">
              {timelineItems
                .filter((item) => timelineFilter === "all" || item.source === timelineFilter)
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTimelineDetail(item)}
                    className="w-full rounded-lg border border-zinc-200 p-3 text-left hover:bg-zinc-50"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge text={item.badgeMain} />
                        {item.badgeSub ? <Badge text={item.badgeSub} /> : null}
                        <span className="text-sm font-medium text-zinc-900">{item.title}</span>
                      </div>
                      <span className="text-xs text-zinc-500">{formatDateTimeVi(item.time)}</span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-700">{item.summary}</p>
                  </button>
                ))}
            </div>
          )}
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

      <Modal open={Boolean(timelineDetail)} title="Chi tiết nhật ký" onClose={() => setTimelineDetail(null)}>
        {timelineDetail ? (
          <div className="space-y-2">
            <div className="text-sm text-zinc-700">
              <span className="font-semibold">Thời gian: </span>
              {formatDateTimeVi(timelineDetail.time)}
            </div>
            <div className="text-sm text-zinc-700">
              <span className="font-semibold">Tiêu đề: </span>
              {timelineDetail.title}
            </div>
            <pre className="overflow-auto rounded-lg bg-zinc-50 p-3 text-xs text-zinc-700">
              {JSON.stringify(timelineDetail.raw, null, 2)}
            </pre>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
