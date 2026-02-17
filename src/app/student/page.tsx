"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrencyVnd, formatDateTimeVi } from "@/lib/date-utils";

/* ---------- Types (unchanged) ---------- */
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

/* ---------- Helpers ---------- */
function mapStudyStatus(value: string) {
  const m: Record<string, string> = {
    enrolled: "Đã ghi danh", studying: "Đang học", paused: "Tạm dừng",
    done: "Hoàn tất", examined: "Đã thi", result: "Có kết quả",
  };
  return m[value.toLowerCase()] ?? value;
}

function studyStatusColor(value: string) {
  const s = value.toLowerCase();
  if (s === "studying") return "bg-emerald-500/10 text-emerald-700 border-emerald-200";
  if (s === "paused") return "bg-amber-500/10 text-amber-700 border-amber-200";
  if (s === "done") return "bg-slate-500/10 text-slate-700 border-slate-300";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function mapContentCategory(value: string) {
  const m: Record<string, string> = {
    huong_dan: "Hướng dẫn", meo_hoc: "Mẹo học", ho_so: "Hồ sơ", thi: "Thi",
  };
  return m[value.toLowerCase()] ?? value;
}

function mapLessonType(value: string) {
  const m: Record<string, string> = {
    SA_HINH: "Sa hình", DUONG_TRUONG: "Đường trường", DAT: "Đất", CABIN: "Cabin",
  };
  return m[value] ?? "Khác";
}

function lessonTypeBadge(value: string) {
  const s = value.toUpperCase();
  if (s === "SA_HINH") return "bg-blue-100 text-blue-700 border-blue-200";
  if (s === "DUONG_TRUONG") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (s === "DAT") return "bg-purple-100 text-purple-700 border-purple-200";
  if (s === "CABIN") return "bg-orange-100 text-orange-700 border-orange-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

/* ---------- Reusable UI Primitives ---------- */
function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/60 ${className}`} />;
}

function EmptyState({ icon, title, description, cta, onAction }: {
  icon: string; title: string; description: string; cta?: string; onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300/80 bg-slate-50/50 px-5 py-8 text-center">
      <span className="text-3xl">{icon}</span>
      <p className="mt-3 text-sm font-semibold text-slate-700">{title}</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500">{description}</p>
      {cta && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-900 shadow-sm transition hover:bg-amber-400 active:scale-[0.98]"
          aria-label={cta}
        >
          {cta}
        </button>
      ) : null}
    </div>
  );
}

function SectionCard({ children, className = "", hover = true }: {
  children: React.ReactNode; className?: string; hover?: boolean;
}) {
  return (
    <div className={`rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm md:p-5 ${hover ? "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md" : ""} ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">{children}</h2>
      {action}
    </div>
  );
}

/* ---------- Toast ---------- */
function showToast(msg: string) {
  const el = document.createElement("div");
  el.textContent = msg;
  el.className = "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-lg transition-all animate-[fadeInUp_0.3s_ease]";
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateX(-50%) translateY(8px)"; }, 2000);
  setTimeout(() => el.remove(), 2500);
}

/* ---------- Main Page ---------- */
export default function StudentDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<MeResponse | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [instructor, setInstructor] = useState<InstructorInfo>(null);
  const [practicalLessons, setPracticalLessons] = useState<PracticalLessonItem[]>([]);
  const [examPlan, setExamPlan] = useState<ExamPlanInfo | null>(null);
  const [modulesLoading, setModulesLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await fetch("/api/student/me", { credentials: "include" });
      const body = await res.json().catch(() => null);
      if (!active) return;
      if (!res.ok) {
        if (res.status === 401) { router.replace("/student/login"); return; }
        setError(body?.error?.message || "Không tải được dữ liệu");
        setLoading(false);
        return;
      }
      setData(body);
      setLastUpdatedAt(new Date().toISOString());
      setLoading(false);

      const [instrRes, schedRes, examRes] = await Promise.all([
        fetch("/api/student/me/instructor", { credentials: "include" }).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch("/api/student/me/schedule", { credentials: "include" }).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch("/api/student/me/exam-plan", { credentials: "include" }).then(r => r.ok ? r.json() : null).catch(() => null),
      ]);
      if (!active) return;
      if (instrRes?.instructor) setInstructor(instrRes.instructor);
      if (schedRes?.items) setPracticalLessons(schedRes.items);
      if (examRes) setExamPlan(examRes);
      setModulesLoading(false);
    })();
    return () => { active = false; };
  }, [router]);

  const handleContactSupport = useCallback(() => {
    const phone = data?.support?.phone || "0902795323";
    navigator.clipboard.writeText(phone).then(
      () => showToast(`📋 Đã copy SĐT: ${phone}`),
      () => showToast(`📞 Gọi: ${phone}`)
    );
  }, [data?.support?.phone]);

  /* ---- Loading skeleton ---- */
  if (loading) {
    return (
      <div className="space-y-5">
        <SkeletonBlock className="h-40 w-full" />
        <div className="grid gap-4 md:grid-cols-3">
          <SkeletonBlock className="h-28" />
          <SkeletonBlock className="h-28" />
          <SkeletonBlock className="h-28" />
        </div>
        <div className="grid gap-4 lg:grid-cols-5">
          <SkeletonBlock className="col-span-3 h-64" />
          <SkeletonBlock className="col-span-2 h-64" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <span className="text-4xl">⚠️</span>
        <p className="mt-3 text-sm font-semibold text-slate-700">{error || "Không có dữ liệu"}</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white">
          Thử lại
        </button>
      </div>
    );
  }

  const paidPercent = data.finance.totalTuition > 0 ? Math.round((data.finance.paid / data.finance.totalTuition) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* ═══════ HERO ═══════ */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 text-white shadow-lg md:p-7">
        {/* Decorative glow */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-amber-500/20 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-amber-500/10 blur-2xl" aria-hidden="true" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${studyStatusColor(data.student.studyStatus)}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {mapStudyStatus(data.student.studyStatus)}
              </span>
              {!data.finance.paid50 && (
                <span className="inline-flex items-center rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300">
                  Chưa đạt mốc 50%
                </span>
              )}
            </div>

            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Xin chào, {data.student.fullName || "Học viên"} 👋
            </h1>

            <p className="text-sm text-slate-300">
              Khóa: <span className="font-medium text-white">{data.student.course?.code || "Chưa gán khóa"}</span>
              {lastUpdatedAt && <> • Cập nhật: {formatDateTimeVi(lastUpdatedAt)}</>}
            </p>
          </div>

          {/* Quick actions */}
          <div className="flex flex-wrap gap-2">
            <Link
              href="/student/schedule"
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm transition hover:bg-amber-400 active:scale-[0.97]"
              aria-label="Xem lịch học"
            >
              📅 Xem lịch học
            </Link>
            <button
              type="button"
              onClick={handleContactSupport}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-500/50 bg-slate-700/50 px-4 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-slate-600/50"
              aria-label="Liên hệ hỗ trợ"
            >
              💬 Liên hệ hỗ trợ
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative mt-5">
          {data.finance.totalTuition > 0 ? (
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-300">Tiến độ học phí</span>
                <span className="font-bold text-amber-400">{paidPercent}%</span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-700">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-700"
                  style={{ width: `${Math.min(paidPercent, 100)}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl bg-slate-700/50 px-4 py-3">
              <span className="text-lg">📊</span>
              <div>
                <p className="text-xs font-medium text-slate-300">Chưa có thông tin học phí</p>
                <button
                  type="button"
                  onClick={handleContactSupport}
                  className="mt-0.5 text-xs font-semibold text-amber-400 hover:text-amber-300"
                >
                  Liên hệ trung tâm →
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ═══════ KPI TILES ═══════ */}
      <section className="grid gap-4 md:grid-cols-3">
        {/* Total tuition */}
        <SectionCard>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-lg">💳</div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Tổng học phí</p>
              <p className="mt-0.5 text-xl font-bold text-slate-900">{formatCurrencyVnd(data.finance.totalTuition)}</p>
            </div>
          </div>
        </SectionCard>

        {/* Paid */}
        <SectionCard>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-lg">✅</div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Đã thanh toán</p>
              <p className="mt-0.5 text-xl font-bold text-emerald-700">{formatCurrencyVnd(data.finance.paid)}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">Tỷ lệ: <span className="font-semibold text-slate-700">{paidPercent}%</span></p>
        </SectionCard>

        {/* Remaining */}
        <SectionCard className="border-amber-200/80 bg-amber-50/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-lg">⏳</div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-amber-600">Còn lại</p>
              <p className="mt-0.5 text-xl font-bold text-amber-800">{formatCurrencyVnd(data.finance.remaining)}</p>
            </div>
          </div>
          {!data.finance.paid50 ? (
            <Link
              href="/student/finance"
              className="mt-3 inline-flex items-center gap-1 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-500/20"
            >
              ⚡ Xem hướng dẫn đóng
            </Link>
          ) : (
            <p className="mt-3 text-xs font-medium text-emerald-600">✓ Đạt mốc 50% học phí</p>
          )}
        </SectionCard>
      </section>

      {/* ═══════ MAIN GRID ═══════ */}
      <section className="grid gap-4 lg:grid-cols-5">
        {/* Left column (3/5) */}
        <div className="space-y-4 lg:col-span-3">
          {/* Schedule */}
          <SectionCard>
            <SectionTitle action={
              <Link href="/student/schedule" className="text-xs font-semibold text-amber-600 hover:text-amber-500">
                Xem toàn bộ →
              </Link>
            }>
              📅 Lịch học sắp tới
            </SectionTitle>
            {data.schedule.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  icon="📭"
                  title="Chưa có lịch học sắp tới"
                  description="Lịch sẽ hiện ngay khi trung tâm cập nhật. Nếu cần gấp, bấm liên hệ hỗ trợ."
                  cta="Nhắc trung tâm xếp lịch"
                  onAction={handleContactSupport}
                />
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {data.schedule.slice(0, 3).map((item) => (
                  <div key={item.id} className="group flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 px-4 py-3 transition hover:border-amber-200 hover:bg-amber-50/30">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-sm font-bold text-slate-600 shadow-sm">
                      {new Date(item.startAt).getDate()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-500">{formatDateTimeVi(item.startAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Practical lessons */}
          <SectionCard>
            <SectionTitle>🚗 Lịch thực hành (14 ngày tới)</SectionTitle>
            {modulesLoading ? (
              <div className="mt-4 space-y-2">
                <SkeletonBlock className="h-16" />
                <SkeletonBlock className="h-16" />
              </div>
            ) : practicalLessons.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  icon="🛞"
                  title="Chưa có lịch thực hành"
                  description="Lịch thực hành sẽ hiện khi giáo viên lên lịch. Chờ giáo viên sắp xếp buổi học cho bạn."
                  cta="Liên hệ hỗ trợ"
                  onAction={handleContactSupport}
                />
              </div>
            ) : (
              <div className="relative mt-4">
                {/* Timeline line */}
                <div className="absolute bottom-0 left-5 top-0 w-px bg-slate-200" aria-hidden="true" />
                <div className="space-y-3">
                  {practicalLessons.slice(0, 5).map((l) => (
                    <div key={l.id} className="relative flex gap-3 pl-3">
                      {/* Timeline dot */}
                      <div className="relative z-10 mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-white bg-amber-500 shadow-sm">
                        <div className="h-1.5 w-1.5 rounded-full bg-white" />
                      </div>
                      <div className="w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 transition hover:shadow-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${lessonTypeBadge(l.lessonType)}`}>
                            {mapLessonType(l.lessonType)}
                          </span>
                          <span className="text-xs text-slate-400">• {l.instructorName}</span>
                        </div>
                        <p className="mt-1.5 text-sm font-semibold text-slate-900">{formatDateTimeVi(l.startAt)}</p>
                        {l.location && <p className="mt-0.5 text-xs text-slate-500">📍 {l.location}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>
        </div>

        {/* Right column (2/5) */}
        <div className="space-y-4 lg:col-span-2">
          {/* Instructor */}
          <SectionCard>
            <SectionTitle>👨‍🏫 Giáo viên phụ trách</SectionTitle>
            {modulesLoading ? (
              <div className="mt-4 space-y-3">
                <SkeletonBlock className="h-12" />
                <SkeletonBlock className="h-8 w-2/3" />
              </div>
            ) : instructor ? (
              <div className="mt-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-sm font-bold text-white shadow-sm">
                    {instructor.name.split(" ").slice(-2).map(p => p[0]).join("").toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{instructor.name}</p>
                    <p className="text-xs text-slate-500">Giáo viên thực hành</p>
                  </div>
                </div>
                {instructor.phone && (
                  <a
                    href={`tel:${instructor.phone}`}
                    className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    📞 <span>{instructor.phone}</span>
                  </a>
                )}
              </div>
            ) : (
              <div className="mt-4">
                <EmptyState
                  icon="👤"
                  title="Chưa có giáo viên phụ trách"
                  description="Trung tâm sẽ gán giáo viên sau khi xếp lớp. Bấm liên hệ để được ưu tiên."
                  cta="Liên hệ hỗ trợ"
                  onAction={handleContactSupport}
                />
              </div>
            )}
          </SectionCard>

          {/* Exam plan */}
          <SectionCard>
            <SectionTitle>🎓 Lịch thi dự kiến</SectionTitle>
            {modulesLoading ? (
              <div className="mt-4 space-y-3">
                <SkeletonBlock className="h-16" />
                <SkeletonBlock className="h-16" />
              </div>
            ) : examPlan?.estimatedExamAt || examPlan?.estimatedGraduationAt ? (
              <div className="mt-4 space-y-3">
                {examPlan.estimatedGraduationAt && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Tốt nghiệp dự kiến</p>
                    <p className="mt-1 text-base font-bold text-slate-900">{formatDateTimeVi(examPlan.estimatedGraduationAt)}</p>
                  </div>
                )}
                {examPlan.estimatedExamAt && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-emerald-600">Sát hạch dự kiến</p>
                    <p className="mt-1 text-base font-bold text-emerald-800">{formatDateTimeVi(examPlan.estimatedExamAt)}</p>
                  </div>
                )}
                {examPlan.note && <p className="text-xs text-slate-500">📝 {examPlan.note}</p>}
              </div>
            ) : (
              <div className="mt-4">
                <EmptyState
                  icon="📋"
                  title="Chưa có lịch thi dự kiến"
                  description="Sẽ cập nhật sau khi bạn đủ điều kiện thi sát hạch (hoàn thành giờ đường trường + DAT)."
                />
              </div>
            )}
          </SectionCard>

          {/* Support */}
          <SectionCard>
            <SectionTitle>🤝 Hỗ trợ</SectionTitle>
            <div className="mt-4">
              {data.support?.name ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                      {data.support.name.split(" ").slice(-2).map(p => p[0]).join("").toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{data.support.name}</p>
                      <p className="text-xs text-slate-500">Người hỗ trợ học viên</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {data.support.email && (
                      <a href={`mailto:${data.support.email}`} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
                        ✉️ <span className="font-medium">{data.support.email}</span>
                      </a>
                    )}
                    {data.support.phone && (
                      <a href={`tel:${data.support.phone}`} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
                        📞 <span className="font-medium">{data.support.phone}</span>
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">Chưa gán người hỗ trợ. Liên hệ trực tiếp:</p>
                  <div className="space-y-2">
                    <a
                      href="tel:0902795323"
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                    >
                      📞 Hotline: 0902 795 323
                    </a>
                    <a
                      href="https://zalo.me/0902795323"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
                    >
                      💬 Chat Zalo
                    </a>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      </section>

      {/* ═══════ CONTENT HIGHLIGHTS ═══════ */}
      <SectionCard hover={false}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle>📚 Nội dung nổi bật</SectionTitle>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Làm mới
          </button>
        </div>

        {data.contentHighlights.length === 0 ? (
          <div className="mt-4">
            <p className="mb-3 text-xs font-medium text-slate-500">Gợi ý hôm nay</p>
            <div className="grid gap-3 md:grid-cols-3">
              {/* Static suggestion cards */}
              <a
                href="https://taplai.com/hoc-ly-thuyet-600-cau-lai-xe-o-to-truc-tuyen-moi-nhat.html"
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-xl border border-slate-200/80 bg-gradient-to-br from-blue-50/50 to-white p-4 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
              >
                <span className="text-2xl">📱</span>
                <p className="mt-2 text-sm font-semibold text-slate-900">Tập lý thuyết (10 phút)</p>
                <p className="mt-1 text-xs text-slate-500">Mở miniapp ôn 600 câu mới nhất</p>
              </a>

              <div className="group rounded-xl border border-slate-200/80 bg-gradient-to-br from-amber-50/50 to-white p-4 transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md">
                <span className="text-2xl">✅</span>
                <p className="mt-2 text-sm font-semibold text-slate-900">Checklist trước buổi học</p>
                <p className="mt-1 text-xs text-slate-500">CMND, giấy khám sức khỏe, giày kín mũi</p>
              </div>

              <button
                type="button"
                onClick={() => showToast("💡 Mẹo: Nhớ 20 câu điểm liệt — sai 1 câu = trượt! Tập trung ôn kỹ phần biển cấm.")}
                className="group rounded-xl border border-slate-200/80 bg-gradient-to-br from-purple-50/50 to-white p-4 text-left transition hover:-translate-y-0.5 hover:border-purple-300 hover:shadow-md"
              >
                <span className="text-2xl">💡</span>
                <p className="mt-2 text-sm font-semibold text-slate-900">Mẹo thi: câu điểm liệt</p>
                <p className="mt-1 text-xs text-slate-500">Bấm để xem mẹo thi quan trọng nhất</p>
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {data.contentHighlights.slice(0, 3).map((item) => (
              <div key={item.id} className="group rounded-xl border border-slate-200/80 bg-slate-50/50 px-4 py-3 transition hover:border-amber-200 hover:bg-amber-50/30">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700">
                    {mapContentCategory(item.category)}
                  </span>
                  <span className="text-xs text-slate-400">{formatDateTimeVi(item.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-900">{item.title}</p>
                <Link href="/student/content" className="mt-2 inline-flex text-xs font-semibold text-amber-600 hover:text-amber-500">
                  Xem chi tiết →
                </Link>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
