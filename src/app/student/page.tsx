"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrencyVnd, formatDateTimeVi } from "@/lib/date-utils";

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

export default function StudentDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<MeResponse | null>(null);

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
      setLoading(false);
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
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">Xin chào, {data.student.fullName || "Học viên"}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Khóa học: {data.student.course?.code || "Chưa gán khóa"} • Trạng thái: {data.student.studyStatus}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-500">Tổng học phí</p>
          <p className="text-lg font-semibold text-zinc-900">{formatCurrencyVnd(data.finance.totalTuition)}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-500">Đã thanh toán</p>
          <p className="text-lg font-semibold text-zinc-900">{formatCurrencyVnd(data.finance.paid)}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-500">Còn lại</p>
          <p className="text-lg font-semibold text-zinc-900">{formatCurrencyVnd(data.finance.remaining)}</p>
          <p className="text-xs text-zinc-500">{data.finance.paid50 ? "Đã đạt mốc 50%" : "Chưa đạt mốc 50%"}</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-zinc-900">Lịch học sắp tới</p>
          <div className="mt-2 space-y-1 text-sm text-zinc-700">
            {data.schedule.length === 0 ? <p>Chưa có lịch học sắp tới.</p> : data.schedule.slice(0, 5).map((s) => <p key={s.id}>{formatDateTimeVi(s.startAt)} • {s.title}</p>)}
          </div>
          <Link href="/student/schedule" className="mt-3 inline-block text-sm text-blue-700 hover:underline">
            Xem toàn bộ
          </Link>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-zinc-900">Hỗ trợ</p>
          <div className="mt-2 space-y-1 text-sm text-zinc-700">
            <p>Người phụ trách: {data.support?.name || "Chưa có"}</p>
            <p>Email: {data.support?.email || "-"}</p>
            <p>SĐT liên hệ: {data.support?.phone || "-"}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-zinc-900">Nội dung nổi bật</p>
          <Button variant="secondary" onClick={() => window.location.reload()}>Làm mới</Button>
        </div>
        <div className="mt-2 space-y-1 text-sm text-zinc-700">
          {data.contentHighlights.length === 0 ? <p>Chưa có nội dung.</p> : data.contentHighlights.map((item) => <p key={item.id}>{item.title}</p>)}
        </div>
      </div>
    </div>
  );
}
