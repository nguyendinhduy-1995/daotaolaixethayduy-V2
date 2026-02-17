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
import { formatDateVi, formatTimeHm, todayInHoChiMinh } from "@/lib/date-utils";

type CourseOption = { id: string; code: string };

type ScheduleRow = {
  id: string;
  title: string;
  startAt: string;
  endAt: string | null;
  course: { id: string; code: string };
  meta: { location: string; note: string; status: string };
  scheduleStatus: "upcoming" | "ongoing" | "done" | "inactive";
  attendance: { expected: number; present: number; absent: number; late: number };
};

type ListResponse = {
  items: ScheduleRow[];
  page: number;
  pageSize: number;
  total: number;
};

type CourseListResponse = {
  items: CourseOption[];
};

type StudentOption = {
  id: string;
  courseId: string | null;
  lead: {
    fullName: string | null;
    phone: string | null;
  };
  course: {
    id: string;
    code: string;
  } | null;
};

type StudentListResponse = {
  items: StudentOption[];
  total: number;
};

type ManualScheduleStatus = "planned" | "done" | "cancelled";

function formatApiError(err: ApiClientError) {
  return `${err.code}: ${err.message}`;
}

function statusLabel(status: ScheduleRow["scheduleStatus"]) {
  if (status === "upcoming") return "Sắp diễn ra";
  if (status === "ongoing") return "Đang diễn ra";
  if (status === "done") return "Đã kết thúc";
  return "Tạm dừng";
}

function manualStatusLabel(status: string) {
  if (status === "planned" || status === "PLANNED") return "Dự kiến";
  if (status === "done" || status === "DONE") return "Đã học";
  if (status === "cancelled" || status === "CANCELLED") return "Hủy";
  return "-";
}

function toIsoAtHcm(date: string, time: string) {
  return `${date}T${time}:00+07:00`;
}

export default function SchedulePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState<ScheduleRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [courseId, setCourseId] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState(todayInHoChiMinh());
  const [to, setTo] = useState(todayInHoChiMinh());
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [location, setLocation] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [studentQ, setStudentQ] = useState("");
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [createForm, setCreateForm] = useState({
    targetType: "course" as "course" | "student",
    courseId: "",
    studentId: "",
    date: todayInHoChiMinh(),
    startTime: "",
    endTime: "",
    location: "",
    note: "",
    status: "planned" as ManualScheduleStatus,
    title: "",
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

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (courseId) params.set("courseId", courseId);
    if (status) params.set("status", status);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (q.trim()) params.set("q", q.trim());
    if (location.trim()) params.set("location", location.trim());
    return params.toString();
  }, [courseId, from, location, page, pageSize, q, status, to]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(qInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [qInput]);

  const loadCourses = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const data = await fetchJson<CourseListResponse>("/api/courses?page=1&pageSize=100", { token });
      setCourses(data.items);
    } catch {
      setCourses([]);
    }
  }, []);

  const loadStudents = useCallback(
    async (keyword: string) => {
      const token = getToken();
      if (!token) return;
      setStudentsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", "1");
        params.set("pageSize", "100");
        if (keyword.trim()) params.set("q", keyword.trim());
        const data = await fetchJson<StudentListResponse>(`/api/students?${params.toString()}`, { token });
        setStudents(data.items.filter((item) => Boolean(item.courseId)));
      } catch {
        setStudents([]);
      } finally {
        setStudentsLoading(false);
      }
    },
    []
  );

  const loadItems = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson<ListResponse>(`/api/schedule?${query}`, { token });
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, [handleAuthError, query]);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (!createOpen) return;
    const timer = setTimeout(() => {
      void loadStudents(studentQ);
    }, 300);
    return () => clearTimeout(timer);
  }, [createOpen, loadStudents, studentQ]);

  async function createManualSchedule() {
    const token = getToken();
    if (!token) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(createForm.date)) {
      setError("Ngày không hợp lệ.");
      return;
    }
    if (!createForm.startTime) {
      setError("Vui lòng nhập giờ bắt đầu.");
      return;
    }
    if (createForm.targetType === "course" && !createForm.courseId) {
      setError("Vui lòng chọn khóa học.");
      return;
    }
    if (createForm.targetType === "student" && !createForm.studentId) {
      setError("Vui lòng chọn học viên.");
      return;
    }

    setCreateSaving(true);
    setError("");
    try {
      await fetchJson("/api/schedule", {
        method: "POST",
        token,
        body: {
          courseId: createForm.targetType === "course" ? createForm.courseId : undefined,
          studentId: createForm.targetType === "student" ? createForm.studentId : undefined,
          title: createForm.title.trim() || "Lịch học thủ công",
          startAt: toIsoAtHcm(createForm.date, createForm.startTime),
          endAt: createForm.endTime ? toIsoAtHcm(createForm.date, createForm.endTime) : null,
          location: createForm.location.trim() || null,
          note: createForm.note.trim() || null,
          status: createForm.status,
          type: "study",
        },
      });

      setCreateOpen(false);
      setCreateForm({
        targetType: "course",
        courseId: "",
        studentId: "",
        date: todayInHoChiMinh(),
        startTime: "",
        endTime: "",
        location: "",
        note: "",
        status: "planned",
        title: "",
      });
      await loadItems();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(formatApiError(err));
    } finally {
      setCreateSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-900">Vận hành lịch</h1>
        <div className="flex items-center gap-2">
          <Button onClick={() => setCreateOpen(true)}>Thêm lịch học</Button>
          <Button variant="secondary" onClick={loadItems} disabled={loading}>
            {loading ? "Đang tải..." : "Làm mới"}
          </Button>
        </div>
      </div>

      {error ? <Alert type="error" message={error} /> : null}

      <div className="grid gap-2 rounded-xl bg-white p-4 shadow-sm md:grid-cols-3 lg:grid-cols-6">
        <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        <Select value={courseId} onChange={(e) => { setCourseId(e.target.value); setPage(1); }}>
          <option value="">Tất cả khóa học</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.code}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Tất cả trạng thái</option>
          <option value="upcoming">Sắp diễn ra</option>
          <option value="ongoing">Đang diễn ra</option>
          <option value="done">Đã kết thúc</option>
          <option value="inactive">Tạm dừng</option>
        </Select>
        <Input placeholder="Tìm tên/SĐT học viên" value={qInput} onChange={(e) => setQInput(e.target.value)} />
        <Input placeholder="Địa điểm" value={location} onChange={(e) => { setLocation(e.target.value); setPage(1); }} />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-zinc-700">
          <Spinner /> Đang tải...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl bg-white p-6 text-sm text-zinc-600 shadow-sm">Không có dữ liệu</div>
      ) : (
        <div className="space-y-3">
          <Table headers={["Ngày", "Giờ", "Khóa học", "Địa điểm", "Trạng thái học", "Số HV dự kiến", "Có mặt", "Vắng", "Trễ", "Trạng thái hệ thống", "Hành động"]}>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-zinc-100">
                <td className="px-3 py-2 text-sm text-zinc-700">{formatDateVi(item.startAt)}</td>
                <td className="px-3 py-2 text-sm text-zinc-700">
                  {formatTimeHm(item.startAt)}
                  {item.endAt ? ` - ${formatTimeHm(item.endAt)}` : ""}
                </td>
                <td className="px-3 py-2 text-sm text-zinc-700">{item.course.code}</td>
                <td className="px-3 py-2 text-sm text-zinc-700">{item.meta.location || "-"}</td>
                <td className="px-3 py-2 text-sm text-zinc-700">{manualStatusLabel(item.meta.status)}</td>
                <td className="px-3 py-2 text-sm text-zinc-700">{item.attendance.expected}</td>
                <td className="px-3 py-2 text-sm text-zinc-700">{item.attendance.present}</td>
                <td className="px-3 py-2 text-sm text-zinc-700">{item.attendance.absent}</td>
                <td className="px-3 py-2 text-sm text-zinc-700">{item.attendance.late}</td>
                <td className="px-3 py-2 text-sm text-zinc-700">{statusLabel(item.scheduleStatus)}</td>
                <td className="px-3 py-2">
                  <Link href={`/schedule/${item.id}`} className="rounded-lg border border-zinc-300 px-2 py-1 text-xs text-zinc-700">
                    Chi tiết buổi học
                  </Link>
                </td>
              </tr>
            ))}
          </Table>
          <div className="flex items-center justify-between gap-3">
            <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
            <Select value={String(pageSize)} onChange={(e) => { setPage(1); setPageSize(Number(e.target.value)); }}>
              <option value="20">20 / trang</option>
              <option value="50">50 / trang</option>
              <option value="100">100 / trang</option>
            </Select>
          </div>
        </div>
      )}

      <Modal
        open={createOpen}
        title="Thêm lịch học"
        description="Nhập tay lịch học theo khóa học hoặc học viên."
        onClose={() => setCreateOpen(false)}
      >
        <div className="space-y-3">
          <div className="grid gap-2 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm text-zinc-600">Tạo theo</label>
              <Select
                value={createForm.targetType}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    targetType: e.target.value as "course" | "student",
                    courseId: "",
                    studentId: "",
                  }))
                }
              >
                <option value="course">Khóa học</option>
                <option value="student">Học viên</option>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-zinc-600">Trạng thái</label>
              <Select
                value={createForm.status}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, status: e.target.value as ManualScheduleStatus }))}
              >
                <option value="planned">Dự kiến</option>
                <option value="done">Đã học</option>
                <option value="cancelled">Hủy</option>
              </Select>
            </div>
            {createForm.targetType === "course" ? (
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm text-zinc-600">Khóa học</label>
                <Select
                  value={createForm.courseId}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, courseId: e.target.value }))}
                >
                  <option value="">Chọn khóa học</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.code}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm text-zinc-600">Học viên</label>
                <Input placeholder="Tìm học viên theo tên/SĐT" value={studentQ} onChange={(e) => setStudentQ(e.target.value)} />
                <Select
                  value={createForm.studentId}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, studentId: e.target.value }))}
                >
                  <option value="">{studentsLoading ? "Đang tải..." : "Chọn học viên"}</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {(student.lead.fullName || "Không tên") +
                        " - " +
                        (student.lead.phone || "Không SĐT") +
                        (student.course?.code ? ` (${student.course.code})` : "")}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-sm text-zinc-600">Ngày</label>
              <Input
                type="date"
                value={createForm.date}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, date: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-zinc-600">Giờ bắt đầu</label>
              <Input
                type="time"
                value={createForm.startTime}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, startTime: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-zinc-600">Giờ kết thúc</label>
              <Input
                type="time"
                value={createForm.endTime}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, endTime: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-zinc-600">Địa điểm</label>
              <Input
                placeholder="Nhập địa điểm"
                value={createForm.location}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, location: e.target.value }))}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm text-zinc-600">Tiêu đề (tùy chọn)</label>
              <Input
                placeholder="Mặc định: Lịch học thủ công"
                value={createForm.title}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm text-zinc-600">Ghi chú</label>
              <Input
                placeholder="Ghi chú buổi học"
                value={createForm.note}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, note: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Hủy
            </Button>
            <Button onClick={createManualSchedule} disabled={createSaving}>
              {createSaving ? "Đang lưu..." : "Lưu lịch học"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
