"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, getToken } from "@/lib/auth-client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table } from "@/components/ui/table";
import { formatDateVi, formatDateTimeVi, formatTimeHm } from "@/lib/date-utils";

type DetailResponse = {
  item: {
    id: string;
    title: string;
    startAt: string;
    endAt: string | null;
    rule: unknown;
    course: { id: string; code: string; province: string | null; licenseType: string | null };
    meta: { location: string; note: string; status: string };
    scheduleStatus: string;
    isActive: boolean;
  };
  students: Array<{
    id: string;
    studyStatus: string;
    lead: { id: string; fullName: string | null; phone: string | null };
  }>;
  attendance: Array<{
    id: string;
    studentId: string;
    status: "PRESENT" | "ABSENT" | "LATE";
    note: string | null;
    updatedAt: string;
    updatedBy: { id: string; name: string | null; email: string } | null;
  }>;
  audits: Array<{
    id: string;
    action: string;
    diff: unknown;
    createdAt: string;
    actor: { id: string; name: string | null; email: string } | null;
  }>;
};

type AttendanceFormRow = {
  studentId: string;
  studentName: string;
  phone: string;
  studyStatus: string;
  status: "PRESENT" | "ABSENT" | "LATE";
  note: string;
};

function formatApiError(err: ApiClientError) {
  return `${err.code}: ${err.message}`;
}

function attendanceLabel(value: AttendanceFormRow["status"]) {
  if (value === "PRESENT") return "Có mặt";
  if (value === "ABSENT") return "Vắng";
  return "Trễ";
}

function studyStatusLabel(value: string) {
  if (value === "studying") return "Đang học";
  if (value === "paused") return "Tạm dừng";
  if (value === "done") return "Hoàn thành";
  return value;
}

export default function ScheduleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<"students" | "attendance" | "logs">("students");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [data, setData] = useState<DetailResponse | null>(null);
  const [rows, setRows] = useState<AttendanceFormRow[]>([]);
  const [logDetail, setLogDetail] = useState<DetailResponse["audits"][number] | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    startAt: "",
    endAt: "",
    location: "",
    note: "",
    status: "",
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

  const presentCount = useMemo(() => rows.filter((r) => r.status === "PRESENT").length, [rows]);
  const absentCount = useMemo(() => rows.filter((r) => r.status === "ABSENT").length, [rows]);
  const lateCount = useMemo(() => rows.filter((r) => r.status === "LATE").length, [rows]);

  const loadDetail = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetchJson<DetailResponse>(`/api/schedule/${id}`, { token });
      setData(res);

      const recordMap = new Map(res.attendance.map((r) => [r.studentId, r]));
      const initRows: AttendanceFormRow[] = res.students.map((student) => {
        const record = recordMap.get(student.id);
        return {
          studentId: student.id,
          studentName: student.lead.fullName || "Không rõ",
          phone: student.lead.phone || "-",
          studyStatus: student.studyStatus,
          status: record?.status || "ABSENT",
          note: record?.note || "",
        };
      });
      setRows(initRows);

      const startLocal = res.item.startAt.slice(0, 16);
      const endLocal = res.item.endAt ? res.item.endAt.slice(0, 16) : "";
      setEditForm({
        title: res.item.title,
        startAt: startLocal,
        endAt: endLocal,
        location: res.item.meta.location || "",
        note: res.item.meta.note || "",
        status: res.item.meta.status || "",
        isActive: res.item.isActive,
      });
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, [handleAuthError, id]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  async function saveAttendance() {
    const token = getToken();
    if (!token) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await fetchJson(`/api/schedule/${id}/attendance`, {
        method: "POST",
        token,
        body: {
          records: rows.map((row) => ({
            studentId: row.studentId,
            status: row.status,
            note: row.note || null,
          })),
        },
      });
      setSuccess("Đã lưu điểm danh.");
      await loadDetail();
      setTab("logs");
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    const token = getToken();
    if (!token) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await fetchJson(`/api/schedule/${id}`, {
        method: "PATCH",
        token,
        body: {
          title: editForm.title,
          startAt: editForm.startAt ? new Date(editForm.startAt).toISOString() : undefined,
          endAt: editForm.endAt ? new Date(editForm.endAt).toISOString() : null,
          location: editForm.location || null,
          note: editForm.note || null,
          status: editForm.status || null,
          isActive: editForm.isActive,
        },
      });
      setSuccess("Đã cập nhật thông tin buổi học.");
      setEditing(false);
      await loadDetail();
    } catch (e) {
      const err = e as ApiClientError;
      if (!handleAuthError(err)) setError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-zinc-700">
        <Spinner /> Đang tải...
      </div>
    );
  }

  if (!data) {
    return <Alert type="error" message={error || "Không tìm thấy buổi học"} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/schedule" className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700">
            Quay lại
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">{data.item.title}</h1>
            <p className="text-sm text-zinc-500">
              {formatDateVi(data.item.startAt)} {formatTimeHm(data.item.startAt)}
              {data.item.endAt ? ` - ${formatTimeHm(data.item.endAt)}` : ""}
              {" • "}
              {data.item.course.code}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Sửa
          </Button>
          <Button onClick={() => setTab("attendance")}>Điểm danh</Button>
        </div>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="grid gap-2 md:grid-cols-2">
          <p className="text-sm text-zinc-700">Địa điểm: {data.item.meta.location || "-"}</p>
          <p className="text-sm text-zinc-700">Trạng thái buổi: {data.item.meta.status || data.item.scheduleStatus}</p>
          <p className="text-sm text-zinc-700 md:col-span-2">Ghi chú: {data.item.meta.note || "-"}</p>
        </div>
      </div>

      {error ? <Alert type="error" message={error} /> : null}
      {success ? <Alert type="success" message={success} /> : null}

      <div className="flex gap-2">
        <Button variant={tab === "students" ? "primary" : "secondary"} onClick={() => setTab("students")}>
          Danh sách học viên
        </Button>
        <Button variant={tab === "attendance" ? "primary" : "secondary"} onClick={() => setTab("attendance")}>
          Điểm danh
        </Button>
        <Button variant={tab === "logs" ? "primary" : "secondary"} onClick={() => setTab("logs")}>
          Nhật ký
        </Button>
      </div>

      {tab === "students" ? (
        <Table headers={["Học viên", "SĐT", "Trạng thái học"]}>
          {data.students.map((student) => (
            <tr key={student.id} className="border-t border-zinc-100">
              <td className="px-3 py-2 text-sm text-zinc-700">{student.lead.fullName || "-"}</td>
              <td className="px-3 py-2 text-sm text-zinc-700">{student.lead.phone || "-"}</td>
              <td className="px-3 py-2 text-sm text-zinc-700">{studyStatusLabel(student.studyStatus)}</td>
            </tr>
          ))}
        </Table>
      ) : null}

      {tab === "attendance" ? (
        <div className="space-y-3">
          <div className="rounded-xl bg-white p-4 text-sm text-zinc-700 shadow-sm">
            Tổng: {rows.length} • Có mặt: {presentCount} • Vắng: {absentCount} • Trễ: {lateCount}
          </div>
          <Table headers={["Học viên", "SĐT", "Trạng thái", "Ghi chú"]}>
            {rows.map((row, index) => (
              <tr key={row.studentId} className="border-t border-zinc-100">
                <td className="px-3 py-2 text-sm text-zinc-700">{row.studentName}</td>
                <td className="px-3 py-2 text-sm text-zinc-700">{row.phone}</td>
                <td className="px-3 py-2">
                  <Select
                    value={row.status}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((item, i) => (i === index ? { ...item, status: e.target.value as AttendanceFormRow["status"] } : item))
                      )
                    }
                  >
                    <option value="PRESENT">{attendanceLabel("PRESENT")}</option>
                    <option value="ABSENT">{attendanceLabel("ABSENT")}</option>
                    <option value="LATE">{attendanceLabel("LATE")}</option>
                  </Select>
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={row.note}
                    onChange={(e) =>
                      setRows((prev) => prev.map((item, i) => (i === index ? { ...item, note: e.target.value } : item)))
                    }
                    placeholder="Ghi chú"
                  />
                </td>
              </tr>
            ))}
          </Table>
          <div className="flex justify-end">
            <Button onClick={saveAttendance} disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu"}
            </Button>
          </div>
        </div>
      ) : null}

      {tab === "logs" ? (
        <Table headers={["Thời gian", "Hành động", "Người thực hiện", "Chi tiết"]}>
          {data.audits.map((audit) => (
            <tr key={audit.id} className="border-t border-zinc-100">
              <td className="px-3 py-2 text-sm text-zinc-700">{formatDateTimeVi(audit.createdAt)}</td>
              <td className="px-3 py-2 text-sm text-zinc-700">{audit.action}</td>
              <td className="px-3 py-2 text-sm text-zinc-700">{audit.actor?.name || audit.actor?.email || "-"}</td>
              <td className="px-3 py-2">
                <Button variant="secondary" className="h-7 px-2 py-1 text-xs" onClick={() => setLogDetail(audit)}>
                  Xem JSON
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      ) : null}

      <Modal open={editing} title="Sửa buổi học" onClose={() => setEditing(false)}>
        <div className="space-y-3">
          <Input value={editForm.title} onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))} placeholder="Tiêu đề" />
          <Input type="datetime-local" value={editForm.startAt} onChange={(e) => setEditForm((p) => ({ ...p, startAt: e.target.value }))} />
          <Input type="datetime-local" value={editForm.endAt} onChange={(e) => setEditForm((p) => ({ ...p, endAt: e.target.value }))} />
          <Input value={editForm.location} onChange={(e) => setEditForm((p) => ({ ...p, location: e.target.value }))} placeholder="Địa điểm" />
          <Input value={editForm.status} onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))} placeholder="Trạng thái buổi" />
          <Input value={editForm.note} onChange={(e) => setEditForm((p) => ({ ...p, note: e.target.value }))} placeholder="Ghi chú" />
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm((p) => ({ ...p, isActive: e.target.checked }))} />
            Hoạt động
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(false)}>
              Hủy
            </Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(logDetail)} title="Chi tiết nhật ký" onClose={() => setLogDetail(null)}>
        <pre className="max-h-[420px] overflow-auto rounded-lg bg-zinc-900 p-3 text-xs text-zinc-100">
          {JSON.stringify(logDetail, null, 2)}
        </pre>
      </Modal>
    </div>
  );
}
