"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrencyVnd, formatDateTimeVi } from "@/lib/date-utils";

type InstructorInfo = { id: string; name: string; phone: string | null; status: string } | null;
type PracticalLessonItem = { id: string; startAt: string; endAt: string | null; location: string | null; lessonType: string; instructorName: string; note: string | null };
type ExamPlanInfo = { estimatedGraduationAt: string | null; estimatedExamAt: string | null; note: string | null };


type MeResponse = {
  student: {
    fullName: string | null;
    phone: string | null;
    course: { id: string; code: string } | null;
    studyStatus: string;
  };
  finance: {
    totalTuition: number;
    paid: number;
    remaining: number;
    paid50: boolean;
  };
  support: { name: string | null; email: string; phone: string | null } | null;
  schedule: Array<{ id: string; title: string; startAt: string }>;
  exam: { examDate: string; examStatus: string | null; examResult: string | null } | null;
  contentHighlights: Array<{ id: string; title: string; category: string; createdAt: string }>;
};

function mapStudyStatus(value: string) {
  const normalized = value.toLowerCase();
  if (normalized === "enrolled") return "Đã ghi danh";
  if (normalized === "studying") return "Đang học";
  if (normalized === "paused") return "Tạm dừng";
  if (normalized === "examined") return "Đã thi";
  if (normalized === "result") return "Có kết quả";
  return value;
}

function mapContentCategory(value: string) {
  const normalized = value.toLowerCase();
  if (normalized === "huong_dan") return "Hướng dẫn";
  if (normalized === "meo_hoc") return "Mẹo học";
  if (normalized === "ho_so") return "Hồ sơ";
  if (normalized === "thi") return "Thi";
  return value;
}

export default function StudentDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<MeResponse | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [instructor, setInstructor] = useState<InstructorInfo>(null);
  const [practicalLessons, setPracticalLessons] = useState<PracticalLessonItem[]>([]);
  const [examPlan, setExamPlan] = useState<ExamPlanInfo | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await fetch("/api/student/me", { credentials: "include" });
      const body = await res.json().catch(() => null);
      if (!active) return;
      if (!res.ok) {
        if (res.status === 401) {
          router.replace("/student/login");
          return;
        }
        setError(body?.error?.message || "Không tải được dữ liệu");
        setLoading(false);
        return;
      }
      setData(body);
      setLastUpdatedAt(new Date().toISOString());
      setLoading(false);

      // Fetch instructor module data
      const [instrRes, schedRes, examRes] = await Promise.all([
        fetch("/api/student/me/instructor", { credentials: "include" }).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch("/api/student/me/schedule", { credentials: "include" }).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch("/api/student/me/exam-plan", { credentials: "include" }).then(r => r.ok ? r.json() : null).catch(() => null),
      ]);
      if (instrRes?.instructor) setInstructor(instrRes.instructor);
      if (schedRes?.items) setPracticalLessons(schedRes.items);
      if (examRes) setExamPlan(examRes);
    })();
    return () => {
      active = false;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-zinc-700">
        <Spinner /> Đang tải...
      </div>
    );
  }

  if (!data) return <Alert type="error" message={error || "Không có dữ liệu"} />;

  return (
    <div className="space-y-4 md:space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-100/70 p-4 shadow-sm md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700">
            {mapStudyStatus(data.student.studyStatus)}
          </span>
          <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${data.finance.paid50
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
          >
            {data.finance.paid50 ? "Đạt mốc 50%" : "Chưa đạt mốc 50%"}
          </span>
        </div>

        <h1 className="mt-3 text-2xl font-semibold text-zinc-900 md:text-3xl">
          Xin chào, {data.student.fullName || "Học viên"}
        </h1>
        <p className="mt-2 text-sm text-zinc-600 md:text-base">
          Khóa học: <span className="font-medium text-zinc-800">{data.student.course?.code || "Chưa gán khóa"}</span>
          {" • "}
          Trạng thái: <span className="font-medium text-zinc-800">{mapStudyStatus(data.student.studyStatus)}</span>
        </p>

        {data.schedule.length === 0 ? (
          <div className="mt-4">
            <Link
              href="/student/schedule"
              className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              Xem lịch học
            </Link>
          </div>
        ) : null}
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Tổng học phí</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{formatCurrencyVnd(data.finance.totalTuition)}</p>
          {lastUpdatedAt ? (
            <p className="mt-3 text-xs text-zinc-500">Cập nhật lần cuối: {formatDateTimeVi(lastUpdatedAt)}</p>
          ) : null}
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Đã thanh toán</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{formatCurrencyVnd(data.finance.paid)}</p>
          <p className="mt-3 text-xs text-zinc-500">
            {data.finance.totalTuition > 0
              ? `Tỷ lệ hoàn tất: ${Math.round((data.finance.paid / data.finance.totalTuition) * 100)}%`
              : "Tỷ lệ hoàn tất: 0%"}
          </p>
        </article>
        <article className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-amber-700">Còn lại</p>
          <p className="mt-2 text-2xl font-semibold text-amber-900">{formatCurrencyVnd(data.finance.remaining)}</p>
          <p className="mt-3 text-xs font-medium text-amber-700">
            {data.finance.paid50 ? "Bạn đã đạt mốc đóng 50% học phí" : "Bạn chưa đạt mốc đóng 50% học phí"}
          </p>
        </article>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900">Lịch học sắp tới</h2>
            <Link href="/student/schedule" className="text-sm font-medium text-zinc-700 hover:text-zinc-900">
              Xem toàn bộ
            </Link>
          </div>
          {data.schedule.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center">
              <p className="text-sm font-medium text-zinc-700">Chưa có lịch học sắp tới</p>
              <p className="mt-1 text-xs text-zinc-500">Lịch mới sẽ hiển thị tại đây ngay khi được cập nhật.</p>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {data.schedule.slice(0, 3).map((item) => (
                <div key={item.id} className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3">
                  <p className="text-sm font-medium text-zinc-900">{item.title}</p>
                  <p className="mt-1 text-xs text-zinc-600">{formatDateTimeVi(item.startAt)}</p>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:p-5">
          <h2 className="text-base font-semibold text-zinc-900">Hỗ trợ</h2>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white">
              {(data.support?.name || "HV")
                .split(" ")
                .slice(-2)
                .map((part) => part[0])
                .join("")
                .toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-900">{data.support?.name || "Chưa có người phụ trách"}</p>
              <p className="text-xs text-zinc-500">Người hỗ trợ học viên</p>
            </div>
          </div>

          <div className="mt-4 space-y-2 text-sm">
            <p className="text-zinc-700">
              Email:{" "}
              {data.support?.email ? (
                <a href={`mailto:${data.support.email}`} className="font-medium text-zinc-900 hover:underline">
                  {data.support.email}
                </a>
              ) : (
                "-"
              )}
            </p>
            <p className="text-zinc-700">
              SĐT:{" "}
              {data.support?.phone ? (
                <a href={`tel:${data.support.phone}`} className="font-medium text-zinc-900 hover:underline">
                  {data.support.phone}
                </a>
              ) : (
                "-"
              )}
            </p>
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-zinc-900">Nội dung nổi bật</h2>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Làm mới
          </Button>
        </div>

        {data.contentHighlights.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center">
            <p className="text-sm font-medium text-zinc-700">Chưa có nội dung nổi bật</p>
            <p className="mt-1 text-xs text-zinc-500">Bạn có thể bấm làm mới để kiểm tra nội dung mới.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {data.contentHighlights.slice(0, 3).map((item) => (
              <div key={item.id} className="rounded-xl border border-zinc-200 px-3 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-full border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                    {mapContentCategory(item.category)}
                  </span>
                  <span className="text-xs text-zinc-500">{formatDateTimeVi(item.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm font-medium text-zinc-900">{item.title}</p>
                <p className="mt-1 truncate text-xs text-zinc-600">Xem hướng dẫn chi tiết trong mục Tài liệu học viên.</p>
                <Link href="/student/content" className="mt-2 inline-flex text-xs font-medium text-zinc-700 hover:text-zinc-900">
                  Xem chi tiết
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Instructor Module Widgets */}
      <section className="grid gap-3 lg:grid-cols-3">
        {/* Instructor Info */}
        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-zinc-900">Giáo viên phụ trách</h2>
          {instructor ? (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                  {instructor.name.split(" ").slice(-2).map(p => p[0]).join("").toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-900">{instructor.name}</p>
                  <p className="text-xs text-zinc-500">Giáo viên thực hành</p>
                </div>
              </div>
              {instructor.phone ? (
                <a href={`tel:${instructor.phone}`} className="mt-2 inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50">
                  📞 {instructor.phone}
                </a>
              ) : null}
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-4 text-center">
              <p className="text-sm font-medium text-amber-800">Chưa có giáo viên phụ trách</p>
              <p className="mt-1 text-xs text-amber-600">Liên hệ trung tâm để được gán giáo viên.</p>
            </div>
          )}
        </article>

        {/* Practical Lessons */}
        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-zinc-900">Lịch thực hành (14 ngày tới)</h2>
          {practicalLessons.length === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-4 text-center">
              <p className="text-sm font-medium text-zinc-700">Chưa có lịch thực hành</p>
              <p className="mt-1 text-xs text-zinc-500">Lịch mới sẽ hiển thị khi được giáo viên lên lịch.</p>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {practicalLessons.slice(0, 5).map((l) => (
                <div key={l.id} className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex rounded-full border border-zinc-300 bg-white px-2 py-0.5 text-xs font-medium text-zinc-700">
                      {l.lessonType === "SA_HINH" ? "Sa hình" : l.lessonType === "DUONG_TRUONG" ? "Đường trường" : l.lessonType === "DAT" ? "Đất" : l.lessonType === "CABIN" ? "Cabin" : "Khác"}
                    </span>
                    <span className="text-xs text-zinc-500">{l.instructorName}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-zinc-900">{formatDateTimeVi(l.startAt)}</p>
                  {l.location ? <p className="text-xs text-zinc-600">📍 {l.location}</p> : null}
                </div>
              ))}
            </div>
          )}
        </article>

        {/* Exam Plan */}
        <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-zinc-900">Lịch thi dự kiến</h2>
          {examPlan?.estimatedExamAt || examPlan?.estimatedGraduationAt ? (
            <div className="mt-3 space-y-3">
              {examPlan.estimatedGraduationAt ? (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Dự kiến hoàn thành</p>
                  <p className="mt-1 text-lg font-semibold text-zinc-900">{formatDateTimeVi(examPlan.estimatedGraduationAt)}</p>
                </div>
              ) : null}
              {examPlan.estimatedExamAt ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-emerald-700">Ngày thi dự kiến</p>
                  <p className="mt-1 text-lg font-semibold text-emerald-900">{formatDateTimeVi(examPlan.estimatedExamAt)}</p>
                </div>
              ) : null}
              {examPlan.note ? <p className="text-xs text-zinc-500">📝 {examPlan.note}</p> : null}
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-4 text-center">
              <p className="text-sm font-medium text-zinc-700">Chưa có lịch thi dự kiến</p>
              <p className="mt-1 text-xs text-zinc-500">Thông tin sẽ được cập nhật sau khi hoàn thành các bước học.</p>
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
