"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, getToken } from "@/lib/auth-client";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table } from "@/components/ui/table";
import { formatDateTimeVi } from "@/lib/date-utils";

type StudyStatus = "studying" | "paused" | "done";

type StudentItem = {
  id: string;
  leadId: string;
  studyStatus: StudyStatus;
  createdAt: string;
  lead: {
    id: string;
    fullName: string | null;
    phone: string | null;
    status: string;
  };
  course: {
    id: string;
    code: string;
  } | null;
};

type StudentsResponse = {
  items: StudentItem[];
  page: number;
  pageSize: number;
  total: number;
};

type CourseItem = {
  id: string;
  code: string;
};

type CoursesResponse = {
  items: CourseItem[];
};

type LeadOption = {
  id: string;
  fullName: string | null;
  phone: string | null;
  status: string;
};

type LeadsResponse = {
  items: LeadOption[];
};

type PendingStatusChange = {
  studentId: string;
  prevStatus: StudyStatus;
  nextStatus: StudyStatus;
};

const STATUS_OPTIONS: Array<{ value: StudyStatus; label: string }> = [
  { value: "studying", label: "Đang học" },
  { value: "paused", label: "Tạm dừng" },
  { value: "done", label: "Hoàn thành" },
];

function parseApiError(err: ApiClientError) {
  return `${err.code}: ${err.message}`;
}

function statusLabel(status: StudyStatus) {
  return STATUS_OPTIONS.find((item) => item.value === status)?.label || status;
}

export default function StudentsPage() {
  const router = useRouter();
  const [items, setItems] = useState<StudentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [courseId, setCourseId] = useState("");
  const [studyStatus, setStudyStatus] = useState<"" | StudyStatus>("");
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [leadQueryInput, setLeadQueryInput] = useState("");
  const [leadQuery, setLeadQuery] = useState("");
  const [leadOptions, setLeadOptions] = useState<LeadOption[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [createForm, setCreateForm] = useState<{
    leadId: string;
    courseId: string;
    studyStatus: StudyStatus;
  }>({
    leadId: "",
    courseId: "",
    studyStatus: "studying",
  });

  const [pendingStatus, setPendingStatus] = useState<PendingStatusChange | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    params.set("sort", "createdAt");
    params.set("order", "desc");
    if (courseId) params.set("courseId", courseId);
    if (studyStatus) params.set("studyStatus", studyStatus);
    if (q.trim()) params.set("q", q.trim());
    return params.toString();
  }, [courseId, page, pageSize, q, studyStatus]);

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

  const loadStudents = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson<StudentsResponse>(`/api/students?${queryString}`, { token });
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`Có lỗi xảy ra: ${parseApiError(err)}`);
    } finally {
      setLoading(false);
    }
  }, [handleAuthError, queryString]);

  const loadCourses = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setCoursesLoading(true);
    try {
      const data = await fetchJson<CoursesResponse>("/api/courses?page=1&pageSize=100", { token });
      setCourses(data.items);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`Không tải được danh sách khóa học: ${parseApiError(err)}`);
    } finally {
      setCoursesLoading(false);
    }
  }, [handleAuthError]);

  const loadLeads = useCallback(
    async (keyword: string) => {
      const token = getToken();
      if (!token) return;
      setLeadsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", "1");
        params.set("pageSize", "20");
        params.set("sort", "createdAt");
        params.set("order", "desc");
        if (keyword.trim()) params.set("q", keyword.trim());
        const data = await fetchJson<LeadsResponse>(`/api/leads?${params.toString()}`, { token });
        setLeadOptions(data.items);
      } catch (e) {
        const err = e as ApiClientError;
        if (!handleAuthError(err)) setError(`Không tải được danh sách khách hàng: ${parseApiError(err)}`);
      } finally {
        setLeadsLoading(false);
      }
    },
    [handleAuthError]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(qInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [qInput]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLeadQuery(leadQueryInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [leadQueryInput]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    if (!createOpen) return;
    loadLeads(leadQuery);
  }, [createOpen, leadQuery, loadLeads]);

  function openCreateModal() {
    setCreateOpen(true);
    setLeadQueryInput("");
    setLeadQuery("");
    setCreateForm({ leadId: "", courseId: "", studyStatus: "studying" });
  }

  async function createStudent() {
    const token = getToken();
    if (!token) return;

    if (!createForm.leadId) {
      setError("Vui lòng chọn khách hàng để tạo học viên.");
      return;
    }

    setCreateSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = {
        leadId: createForm.leadId,
        courseId: createForm.courseId || null,
        studyStatus: createForm.studyStatus,
      };
      const response = await fetchJson<{ student: { id: string } }>("/api/students", {
        method: "POST",
        token,
        body: payload,
      });
      setCreateOpen(false);
      setSuccess("Tạo học viên thành công.");
      router.push(`/students/${response.student.id}`);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`Không thể tạo học viên: ${parseApiError(err)}`);
    } finally {
      setCreateSaving(false);
    }
  }

  function askStatusChange(studentId: string, current: StudyStatus, next: StudyStatus) {
    if (current === next) return;
    setItems((prev) => prev.map((item) => (item.id === studentId ? { ...item, studyStatus: next } : item)));
    setPendingStatus({ studentId, prevStatus: current, nextStatus: next });
  }

  function rollbackStatusChange(change: PendingStatusChange) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === change.studentId
          ? {
              ...item,
              studyStatus: change.prevStatus,
            }
          : item
      )
    );
  }

  async function confirmStatusChange() {
    if (!pendingStatus) return;
    const token = getToken();
    if (!token) return;
    setStatusSaving(true);
    setError("");
    setSuccess("");

    try {
      await fetchJson(`/api/students/${pendingStatus.studentId}`, {
        method: "PATCH",
        token,
        body: { studyStatus: pendingStatus.nextStatus },
      });
      setSuccess("Đã cập nhật trạng thái học viên.");
      setPendingStatus(null);
    } catch (e) {
      const err = e as ApiClientError;
      rollbackStatusChange(pendingStatus);
      if (!handleAuthError(err)) setError(`Không thể cập nhật trạng thái: ${parseApiError(err)}`);
      setPendingStatus(null);
    } finally {
      setStatusSaving(false);
    }
  }

  function cancelStatusChange() {
    if (pendingStatus) rollbackStatusChange(pendingStatus);
    setPendingStatus(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-900">Học viên</h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={loadStudents} disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <Spinner /> Đang tải...
              </span>
            ) : (
              "Làm mới"
            )}
          </Button>
          <Button onClick={openCreateModal}>Tạo học viên</Button>
        </div>
      </div>

      {error ? <Alert type="error" message={error} /> : null}
      {success ? <Alert type="success" message={success} /> : null}

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Khóa học</label>
            <Select
              value={courseId}
              onChange={(e) => {
                setPage(1);
                setCourseId(e.target.value);
              }}
              disabled={coursesLoading}
            >
              <option value="">Tất cả khóa học</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-zinc-600">Trạng thái học</label>
            <Select
              value={studyStatus}
              onChange={(e) => {
                setPage(1);
                setStudyStatus(e.target.value as "" | StudyStatus);
              }}
            >
              <option value="">Tất cả trạng thái</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-zinc-600">Tìm kiếm</label>
            <Input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Tìm tên hoặc SĐT"
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
        <div className="rounded-xl bg-white p-6 text-sm text-zinc-600">Đang tải danh sách học viên...</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl bg-white p-6 text-sm text-zinc-600">
          Không có dữ liệu học viên phù hợp bộ lọc.
        </div>
      ) : (
        <Table headers={["Học viên", "SĐT", "Khóa học", "Trạng thái", "Ngày tạo", "Hành động"]}>
          {items.map((item) => (
            <tr key={item.id} className="border-t border-zinc-100 hover:bg-zinc-50">
              <td className="px-3 py-2">
                <div className="font-medium text-zinc-900">{item.lead.fullName || "Chưa có tên"}</div>
                <div className="text-xs text-zinc-500">{item.id}</div>
              </td>
              <td className="px-3 py-2">{item.lead.phone || "-"}</td>
              <td className="px-3 py-2">{item.course?.code || "-"}</td>
              <td className="px-3 py-2">
                <Badge text={statusLabel(item.studyStatus)} />
              </td>
              <td className="px-3 py-2 text-sm text-zinc-600">{formatDateTimeVi(item.createdAt)}</td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/students/${item.id}`}
                    className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                  >
                    Mở
                  </Link>
                  <Select
                    className="min-w-[140px]"
                    value={item.studyStatus}
                    onChange={(e) =>
                      askStatusChange(item.id, item.studyStatus, e.target.value as StudyStatus)
                    }
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />

      <Modal open={createOpen} title="Tạo học viên" onClose={() => setCreateOpen(false)}>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Tìm khách hàng</label>
            <Input
              placeholder="Nhập tên hoặc SĐT"
              value={leadQueryInput}
              onChange={(e) => setLeadQueryInput(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-zinc-600">Chọn khách hàng</label>
            <Select
              value={createForm.leadId}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, leadId: e.target.value }))}
            >
              <option value="">Chọn một khách hàng</option>
              {leadOptions.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {(lead.fullName || "Chưa có tên") + " - " + (lead.phone || "Không SĐT")}
                </option>
              ))}
            </Select>
            {leadsLoading ? <p className="mt-1 text-xs text-zinc-500">Đang tải khách hàng...</p> : null}
          </div>

          <div>
            <label className="mb-1 block text-sm text-zinc-600">Khóa học</label>
            <Select
              value={createForm.courseId}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, courseId: e.target.value }))}
            >
              <option value="">Chưa gán khóa học</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-zinc-600">Trạng thái ban đầu</label>
            <Select
              value={createForm.studyStatus}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, studyStatus: e.target.value as StudyStatus }))
              }
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Huỷ
            </Button>
            <Button onClick={createStudent} disabled={createSaving}>
              {createSaving ? "Đang tạo..." : "Tạo học viên"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(pendingStatus)} title="Xác nhận đổi trạng thái" onClose={cancelStatusChange}>
        <p className="text-sm text-zinc-700">Đổi trạng thái học viên?</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={cancelStatusChange}>
            Huỷ
          </Button>
          <Button onClick={confirmStatusChange} disabled={statusSaving}>
            {statusSaving ? "Đang cập nhật..." : "Xác nhận"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
