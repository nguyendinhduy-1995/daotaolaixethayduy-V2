"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateVi, formatTimeHm } from "@/lib/date-utils";

type ScheduleItem = {
  id: string;
  title: string;
  type: string;
  startAt: string;
  endAt: string | null;
};

/* ── Helpers ── */
function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/60 ${className}`} />;
}

function typeLabel(value: string) {
  const m: Record<string, string> = {
    ly_thuyet: "Lý thuyết", thuc_hanh: "Thực hành", thi: "Thi sát hạch",
    sa_hinh: "Sa hình", duong_truong: "Đường trường", dat: "Đất", cabin: "Cabin",
  };
  return m[value.toLowerCase()] ?? value;
}

function typeBadgeColor(value: string) {
  const s = value.toLowerCase();
  if (s.includes("ly_thuyet")) return "bg-blue-100 text-blue-700 border-blue-200";
  if (s.includes("thuc_hanh") || s.includes("duong_truong")) return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (s.includes("thi")) return "bg-purple-100 text-purple-700 border-purple-200";
  if (s.includes("sa_hinh")) return "bg-cyan-100 text-cyan-700 border-cyan-200";
  if (s.includes("cabin")) return "bg-orange-100 text-orange-700 border-orange-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function dayOfWeekVi(dateStr: string) {
  const d = new Date(dateStr);
  const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  return days[d.getDay()];
}

function monthNameVi(dateStr: string) {
  const d = new Date(dateStr);
  return `Tháng ${d.getMonth() + 1}`;
}

/* ── Page ── */
export default function StudentSchedulePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState<ScheduleItem[]>([]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/student/me", { credentials: "include" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 401) router.replace("/student/login");
        else setError(body?.error?.message || "Không tải được lịch học");
        setLoading(false);
        return;
      }
      setItems(body.schedule || []);
      setLoading(false);
    })();
  }, [router]);

  /* Loading */
  if (loading) {
    return (
      <div className="space-y-4">
        <SkeletonBlock className="h-10 w-48" />
        <div className="space-y-3">
          <SkeletonBlock className="h-24" />
          <SkeletonBlock className="h-24" />
          <SkeletonBlock className="h-24" />
        </div>
      </div>
    );
  }

  /* Error */
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <span className="text-4xl">⚠️</span>
        <p className="mt-3 text-sm font-semibold text-slate-700">{error}</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white">
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">📅 Lịch học</h1>
          <p className="mt-0.5 text-xs text-slate-500">Lịch học lý thuyết & thực hành sắp tới</p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          ↻ Làm mới
        </button>
      </div>

      {/* Empty */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300/80 bg-white px-5 py-14 text-center shadow-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-3xl">📭</div>
          <p className="mt-4 text-base font-bold text-slate-900">Chưa có lịch học nào</p>
          <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-slate-500">
            Lịch sẽ hiện ngay khi trung tâm hoặc giáo viên xếp lịch cho bạn. Nếu cần gấp, liên hệ hỗ trợ.
          </p>
          <a
            href="tel:0948742666"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-slate-900 shadow-sm transition hover:bg-amber-400 active:scale-[0.97]"
          >
            📞 Gọi trung tâm
          </a>
        </div>
      ) : (
        /* Schedule cards */
        <div className="space-y-3">
          {items.map((item, idx) => {
            const date = new Date(item.startAt);
            const isToday = new Date().toDateString() === date.toDateString();
            const isPast = date.getTime() < Date.now();

            return (
              <div
                key={item.id}
                className={`group relative overflow-hidden rounded-2xl border bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md md:p-5 ${isToday ? "border-amber-300 bg-amber-50/30" : isPast ? "border-slate-200/50 opacity-70" : "border-slate-200/70"
                  }`}
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className="flex gap-3 md:gap-4">
                  {/* Date badge */}
                  <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl shadow-sm md:h-16 md:w-16 ${isToday ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-700"
                    }`}>
                    <span className="text-[10px] font-semibold uppercase leading-none">{dayOfWeekVi(item.startAt)}</span>
                    <span className="text-xl font-bold leading-tight md:text-2xl">{date.getDate()}</span>
                    <span className="text-[9px] font-medium leading-none opacity-70">{monthNameVi(item.startAt)}</span>
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${typeBadgeColor(item.type)}`}>
                        {typeLabel(item.type)}
                      </span>
                      {isToday && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Hôm nay
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm font-semibold text-slate-900 md:text-base">{item.title}</p>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-slate-400">
                        <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
                      </svg>
                      <span>{formatTimeHm(item.startAt)}{item.endAt ? ` – ${formatTimeHm(item.endAt)}` : ""}</span>
                      <span className="text-slate-300">•</span>
                      <span>{formatDateVi(item.startAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
