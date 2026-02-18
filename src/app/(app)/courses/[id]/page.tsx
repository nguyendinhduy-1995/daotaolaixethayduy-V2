"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, getToken } from "@/lib/auth-client";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table } from "@/components/ui/table";
import { formatDateVi, formatTimeHm } from "@/lib/date-utils";

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

type ScheduleItem = {
  id: string;
  type: "study" | "exam" | "reminder";
  title: string;
  startAt: string;
  endAt: string | null;
  location?: string | null;
  note?: string | null;
  rule: unknown;
  isActive: boolean;
};

type CourseDetailResponse = {
  course: Course;
};

type ScheduleListResponse = {
  items: ScheduleItem[];
};

function parseApiError(err: ApiClientError) {
  return `${err.code}: ${err.message}`;
}

function scheduleTypeLabel(type: ScheduleItem["type"]) {
  if (type === "study") return "Học";
  if (type === "exam") return "Thi";
  return "Nhắc lịch";
}

function parseRule(rule: unknown, fallback?: { location?: string | null; note?: string | null }) {
  if (!rule || typeof rule !== "object") {
    return { location: fallback?.location || "", note: fallback?.note || "" };
  }
  const obj = rule as Record<string, unknown>;
  return {
    location: fallback?.location ?? (typeof obj.location === "string" ? obj.location : ""),
    note: fallback?.note ?? (typeof obj.note === "string" ? obj.note : ""),
  };
}

function toIsoAtHcm(date: string, time: string) {
  return `${date}T${time}:00+07:00`;
}

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<"info" | "schedule">("info");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [course, setCourse] = useState<Course | null>(null);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    code: "",
    province: "",
    licenseType: "",
    startDate: "",
    examDate: "",
    description: "",
    isActive: true,
  });

  const [addScheduleOpen, setAddScheduleOpen] = useState(false);
  const [addScheduleSaving, setAddScheduleSaving] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    type: "study" as ScheduleItem["type"],
    title: "",
    date: "",
    startTime: "",
    endTime: "",
    location: "",
    note: "",
    isActive: true,
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

  const loadCourse = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson<CourseDetailResponse>(`/api/courses/${id}`, { token });
      setCourse(data.course);
      setEditForm({
        code: data.course.code,
        province: data.course.province || "",
        licenseType: data.course.licenseType || "",
        startDate: data.course.startDate ? data.course.startDate.slice(0, 10) : "",
        examDate: data.course.examDate ? data.course.examDate.slice(0, 10) : "",
        description: data.course.description || "",
        isActive: data.course.isActive,
      });
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`Có lỗi xảy ra: ${parseApiError(err)}`);
    } finally {
      setLoading(false);
    }
  }, [handleAuthError, id]);

  const loadSchedule = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setScheduleLoading(true);
    setError("");
    try {
      const data = await fetchJson<ScheduleListResponse>(`/api/courses/${id}/schedule`, { token });
      setScheduleItems(data.items);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`Không tải được lịch học: ${parseApiError(err)}`);
    } finally {
      setScheduleLoading(false);
    }
  }, [handleAuthError, id]);

  useEffect(() => {
    loadCourse();
    loadSchedule();
  }, [loadCourse, loadSchedule]);

  async function saveCourseInfo() {
    const token = getToken();
    if (!token || !course) return;
    if (!editForm.code.trim()) {
      setError("Mã khóa học không được để trống.");
      return;
    }
    setEditSaving(true);
    setError("");
    try {
      const data = await fetchJson<CourseDetailResponse>(`/api/courses/${course.id}`, {
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
      setCourse(data.course);
      toast.success("Đã cập nhật thông tin khóa học.");
      setEditOpen(false);
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`Không thể cập nhật khóa học: ${parseApiError(err)}`);
    } finally {
      setEditSaving(false);
    }
  }

  async function addScheduleItem() {
    const token = getToken();
    if (!token || !course) return;
    if (!scheduleForm.title.trim()) {
      setError("Vui lòng nhập tiêu đề buổi học.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduleForm.date)) {
      setError("Ngày không hợp lệ. Định dạng đúng: YYYY-MM-DD.");
      return;
    }
    if (!scheduleForm.startTime) {
      setError("Vui lòng nhập giờ bắt đầu.");
      return;
    }

    setAddScheduleSaving(true);
    setError("");
    try {
      const startAt = toIsoAtHcm(scheduleForm.date, scheduleForm.startTime);
      const endAt = scheduleForm.endTime ? toIsoAtHcm(scheduleForm.date, scheduleForm.endTime) : null;

      await fetchJson(`/api/courses/${course.id}/schedule`, {
        method: "POST",
        token,
        body: {
          type: scheduleForm.type,
          title: scheduleForm.title.trim(),
          startAt,
          endAt,
          isActive: scheduleForm.isActive,
          rule: {
            location: scheduleForm.location.trim() || null,
            note: scheduleForm.note.trim() || null,
          },
        },
      });

      setAddScheduleOpen(false);
      setScheduleForm({
        type: "study",
        title: "",
        date: "",
        startTime: "",
        endTime: "",
        location: "",
        note: "",
        isActive: true,
      });
      toast.success("Đã thêm buổi học.");
      await loadSchedule();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(`Không thể thêm buổi học: ${parseApiError(err)}`);
    } finally {
      setAddScheduleSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-zinc-700">
        <Spinner /> Đang tải...
      </div>
    );
  }

  if (!course) {
    return <Alert type="error" message={error || "Không tìm thấy khóa học"} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/courses" className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700">
            Quay lại
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Khóa học {course.code}</h1>
            <p className="text-sm text-zinc-500">{course.licenseType || "Chưa có loại bằng"}</p>
          </div>
        </div>
        <Button onClick={() => setEditOpen(true)}>Sửa</Button>
      </div>

      {error ? <Alert type="error" message={error} /> : null}

      <div className="flex gap-2">
        <Button variant={tab === "info" ? "primary" : "secondary"} onClick={() => setTab("info")}>
          Thông tin
        </Button>
        <Button variant={tab === "schedule" ? "primary" : "secondary"} onClick={() => setTab("schedule")}>
          Lịch học
        </Button>
      </div>

      {tab === "info" ? (
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-sm text-zinc-500">Mã khóa học</p>
              <p className="text-zinc-900">{course.code}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Trạng thái</p>
              <Badge text={course.isActive ? "Đang hoạt động" : "Ngừng hoạt động"} />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Loại bằng</p>
              <p className="text-zinc-900">{course.licenseType || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Tỉnh/Chi nhánh</p>
              <p className="text-zinc-900">{course.province || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Ngày bắt đầu</p>
              <p className="text-zinc-900">
                {course.startDate ? formatDateVi(course.startDate) : "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Ngày thi</p>
              <p className="text-zinc-900">
                {course.examDate ? formatDateVi(course.examDate) : "-"}
              </p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-zinc-500">Mô tả</p>
              <p className="text-zinc-900">{course.description || "-"}</p>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "schedule" ? (
        <div className="space-y-4 rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">Lịch học</h2>
            <Button onClick={() => setAddScheduleOpen(true)}>Thêm buổi học</Button>
          </div>

          {scheduleLoading ? (
            <div className="text-sm text-zinc-600">Đang tải lịch học...</div>
          ) : scheduleItems.length === 0 ? (
            <div className="rounded-lg bg-zinc-50 p-4 text-sm text-zinc-600">Chưa có lịch học.</div>
          ) : (
            <Table headers={["Ngày", "Khung giờ", "Loại", "Địa điểm", "Ghi chú", "Trạng thái"]}>
              {scheduleItems.map((item) => {
                const meta = parseRule(item.rule, { location: item.location, note: item.note });
                const start = new Date(item.startAt);
                const end = item.endAt ? new Date(item.endAt) : null;
                return (
                  <tr key={item.id} className="border-t border-zinc-100">
                    <td className="px-3 py-2">{formatDateVi(start)}</td>
                    <td className="px-3 py-2">
                      {formatTimeHm(start)}
                      {end
                        ? ` - ${formatTimeHm(end)}`
                        : ""}
                    </td>
                    <td className="px-3 py-2">{scheduleTypeLabel(item.type)}</td>
                    <td className="px-3 py-2">{meta.location || "-"}</td>
                    <td className="px-3 py-2">{meta.note || item.title}</td>
                    <td className="px-3 py-2">
                      <Badge text={item.isActive ? "Đang áp dụng" : "Đã tắt"} />
                    </td>
                  </tr>
                );
              })}
            </Table>
          )}
        </div>
      ) : null}

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
            <Button onClick={saveCourseInfo} disabled={editSaving}>
              {editSaving ? "Đang lưu..." : "Lưu"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={addScheduleOpen} title="Thêm buổi học" onClose={() => setAddScheduleOpen(false)}>
        <div className="space-y-3">
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-zinc-600">Loại lịch</label>
              <Select
                value={scheduleForm.type}
                onChange={(e) =>
                  setScheduleForm((s) => ({ ...s, type: e.target.value as ScheduleItem["type"] }))
                }
              >
                <option value="study">Học</option>
                <option value="exam">Thi</option>
                <option value="reminder">Nhắc lịch</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-600">Trạng thái</label>
              <Select
                value={scheduleForm.isActive ? "true" : "false"}
                onChange={(e) => setScheduleForm((s) => ({ ...s, isActive: e.target.value === "true" }))}
              >
                <option value="true">Đang áp dụng</option>
                <option value="false">Đã tắt</option>
              </Select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Tiêu đề *</label>
            <Input value={scheduleForm.title} onChange={(e) => setScheduleForm((s) => ({ ...s, title: e.target.value }))} />
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm text-zinc-600">Ngày *</label>
              <Input type="date" value={scheduleForm.date} onChange={(e) => setScheduleForm((s) => ({ ...s, date: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-600">Bắt đầu *</label>
              <Input
                type="time"
                value={scheduleForm.startTime}
                onChange={(e) => setScheduleForm((s) => ({ ...s, startTime: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-600">Kết thúc</label>
              <Input
                type="time"
                value={scheduleForm.endTime}
                onChange={(e) => setScheduleForm((s) => ({ ...s, endTime: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Địa điểm</label>
            <Input
              value={scheduleForm.location}
              onChange={(e) => setScheduleForm((s) => ({ ...s, location: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600">Ghi chú</label>
            <Input value={scheduleForm.note} onChange={(e) => setScheduleForm((s) => ({ ...s, note: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAddScheduleOpen(false)}>
              Huỷ
            </Button>
            <Button onClick={addScheduleItem} disabled={addScheduleSaving}>
              {addScheduleSaving ? "Đang lưu..." : "Thêm buổi học"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
