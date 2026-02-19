"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrencyVnd } from "@/lib/date-utils";

type FinanceData = {
  finance: { totalTuition: number; paid: number; remaining: number; paid50: boolean };
  tuitionPlan: { province: string; licenseType: string; tuition: number } | null;
};

/* ── Helpers ── */
function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/60 ${className}`} />;
}

/* ── Page ── */
export default function StudentFinancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<FinanceData | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/student/me", { credentials: "include" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 401) router.replace("/student/login");
        else setError(body?.error?.message || "Không tải được tài chính");
        setLoading(false);
        return;
      }
      setData(body);
      setLoading(false);
    })();
  }, [router]);

  /* Loading */
  if (loading) {
    return (
      <div className="space-y-4">
        <SkeletonBlock className="h-10 w-48" />
        <SkeletonBlock className="h-44" />
        <div className="grid gap-3 md:grid-cols-3">
          <SkeletonBlock className="h-24" />
          <SkeletonBlock className="h-24" />
          <SkeletonBlock className="h-24" />
        </div>
        <SkeletonBlock className="h-40" />
      </div>
    );
  }

  /* Error */
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <span className="text-4xl">⚠️</span>
        <p className="mt-3 text-sm font-semibold text-slate-700">{error || "Không có dữ liệu"}</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white">
          Thử lại
        </button>
      </div>
    );
  }

  const paidPercent = data.finance.totalTuition > 0 ? Math.round((data.finance.paid / data.finance.totalTuition) * 100) : 0;
  const reached50 = data.finance.paid50;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">💰 Tài chính học phí</h1>
        <p className="mt-0.5 text-xs text-slate-500">Tình trạng đóng học phí & hướng dẫn thanh toán</p>
      </div>

      {/* ═══ Progress Hero ═══ */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 text-white shadow-lg md:p-7">
        {/* Decorative */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-500/20 blur-3xl" aria-hidden="true" />

        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {/* Left — Progress ring */}
          <div className="flex items-center gap-5">
            <div className="relative h-20 w-20 shrink-0 md:h-24 md:w-24">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-700" />
                <circle
                  cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={`${paidPercent} 100`}
                  className={paidPercent >= 50 ? "text-emerald-400" : "text-amber-400"}
                  style={{ transition: "stroke-dasharray 1s ease" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-xl font-black md:text-2xl ${paidPercent >= 50 ? "text-emerald-400" : "text-amber-400"}`}>{paidPercent}%</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-300">Tiến độ thanh toán</p>
              <p className="mt-0.5 text-2xl font-black md:text-3xl">{formatCurrencyVnd(data.finance.paid)}</p>
              <p className="mt-0.5 text-xs text-slate-400">trên tổng {formatCurrencyVnd(data.finance.totalTuition)}</p>
            </div>
          </div>

          {/* Right — Status badge */}
          <div className="flex flex-col items-start gap-2 md:items-end">
            {reached50 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 px-3 py-1.5 text-xs font-bold text-emerald-300">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
                </svg>
                Đã đạt mốc 50%
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-400/30 px-3 py-1.5 text-xs font-bold text-amber-300">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                </svg>
                Chưa đạt mốc 50%
              </span>
            )}
            {data.tuitionPlan && (
              <span className="text-xs text-slate-400">
                Bảng phí: {data.tuitionPlan.province} – {data.tuitionPlan.licenseType}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ═══ KPI Cards ═══ */}
      <div className="grid gap-3 md:grid-cols-3">
        {/* Total */}
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-lg">💳</div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Tổng học phí</p>
              <p className="mt-0.5 text-lg font-bold text-slate-900">{formatCurrencyVnd(data.finance.totalTuition)}</p>
            </div>
          </div>
        </div>

        {/* Paid */}
        <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/30 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-lg">✅</div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-600">Đã thanh toán</p>
              <p className="mt-0.5 text-lg font-bold text-emerald-700">{formatCurrencyVnd(data.finance.paid)}</p>
            </div>
          </div>
        </div>

        {/* Remaining */}
        <div className="rounded-2xl border border-amber-200/70 bg-amber-50/30 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-lg">⏳</div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-amber-600">Còn lại</p>
              <p className="mt-0.5 text-lg font-bold text-amber-800">{formatCurrencyVnd(data.finance.remaining)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Payment Guide ═══ */}
      {!reached50 && (
        <div className="rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm md:p-6">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-amber-500">
              <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
            </svg>
            Hướng dẫn đóng học phí
          </h2>
          <div className="mt-4 space-y-3">
            {/* Step 1 */}
            <div className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">1</div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Chuyển khoản ngân hàng</p>
                <p className="mt-0.5 text-xs text-slate-500">Chuyển khoản vào tài khoản trung tâm với nội dung: <span className="font-semibold text-slate-700">[Họ tên] - [SĐT] - Học phí</span></p>
              </div>
            </div>
            {/* Step 2 */}
            <div className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">2</div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Chụp ảnh biên lai</p>
                <p className="mt-0.5 text-xs text-slate-500">Gửi ảnh biên lai cho nhân viên hỗ trợ hoặc qua Zalo</p>
              </div>
            </div>
            {/* Step 3 */}
            <div className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">3</div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Xác nhận & cập nhật</p>
                <p className="mt-0.5 text-xs text-slate-500">Trung tâm sẽ xác nhận và cập nhật số dư trong vòng 24h</p>
              </div>
            </div>
          </div>
          <a
            href="tel:0948742666"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-slate-900 shadow-sm transition hover:bg-amber-400 active:scale-[0.97]"
          >
            📞 Liên hệ đóng phí
          </a>
        </div>
      )}

      {/* ═══ Payment Note — if already passed 50% ═══ */}
      {reached50 && (
        <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/40 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-xl">🎉</div>
            <div>
              <p className="text-sm font-bold text-emerald-800">Bạn đã đạt mốc 50% học phí!</p>
              <p className="mt-1 text-xs leading-relaxed text-emerald-700/80">
                Bạn đủ điều kiện tham gia học thực hành và thi sát hạch. Phần còn lại có thể đóng dần trước ngày thi.
              </p>
              {data.finance.remaining > 0 && (
                <p className="mt-2 text-xs text-slate-500">
                  Còn lại: <span className="font-semibold text-slate-700">{formatCurrencyVnd(data.finance.remaining)}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Contact ═══ */}
      <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900">📞 Hỗ trợ học phí</h2>
        <p className="mt-1 text-xs text-slate-500">Có thắc mắc về học phí? Liên hệ ngay</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href="tel:0948742666"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            📞 Hotline: 0948 742 666
          </a>
          <a
            href="https://zalo.me/0948742666"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
          >
            💬 Chat Zalo
          </a>
        </div>
      </div>
    </div>
  );
}
