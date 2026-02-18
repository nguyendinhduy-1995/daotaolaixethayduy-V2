"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { logoutSession, type MeResponse } from "@/lib/auth-client";
import { isAdminRole } from "@/lib/admin-auth";
import { guardByAuthMe, type AuthGuardResult } from "@/lib/ui-auth-guard";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { MobileTopbar } from "@/components/mobile/MobileTopbar";
import { MobileAdminMenu } from "@/components/mobile/MobileAdminMenu";
import { DesktopSidebarMenu } from "@/components/admin/DesktopSidebarMenu";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ToastProvider } from "@/components/ui/toast";
import { APP_DESCRIPTION, APP_SHORT } from "@/lib/app-meta";

function roleLabel(role: string) {
  if (role === "admin") return "Quản trị";
  if (role === "manager") return "Quản lý";
  if (role === "telesales") return "Tư vấn";
  if (role === "direct_page") return "Trực page";
  if (role === "viewer") return "Chỉ xem";
  return role;
}

function guessPageTitle(pathname: string) {
  const map: Array<{ test: (path: string) => boolean; title: string; subtitle: string }> = [
    { test: (p) => p.startsWith("/dashboard"), title: "Tổng quan", subtitle: "Theo dõi nhanh vận hành trong ngày" },
    { test: (p) => p.startsWith("/leads/board"), title: "Bảng trạng thái", subtitle: "Theo dõi pipeline khách hàng theo trạng thái" },
    { test: (p) => p.startsWith("/leads"), title: "Khách hàng", subtitle: "Quản lý danh sách và lịch sử tương tác" },
    { test: (p) => p.startsWith("/kpi/daily"), title: "KPI ngày", subtitle: "Báo cáo chỉ số theo thời gian" },
    { test: (p) => p.startsWith("/ai/kpi-coach"), title: "Trợ lý công việc", subtitle: "Gợi ý việc nên làm theo dữ liệu và mục tiêu" },
    { test: (p) => p.startsWith("/kpi/targets"), title: "Mục tiêu KPI", subtitle: "Thiết lập mục tiêu theo vai trò, chi nhánh và ngày trong tuần" },
    { test: (p) => p.startsWith("/goals"), title: "Mục tiêu ngày/tháng", subtitle: "Thiết lập doanh thu, hồ sơ và chi phí theo kỳ" },
    { test: (p) => p.startsWith("/students"), title: "Học viên", subtitle: "Danh sách học viên và tiến độ học tập" },
    { test: (p) => p.startsWith("/courses"), title: "Khóa học", subtitle: "Quản lý khóa học và lịch đào tạo" },
    { test: (p) => p.startsWith("/schedule"), title: "Lịch học", subtitle: "Vận hành buổi học và điểm danh" },
    { test: (p) => p.startsWith("/receipts"), title: "Thu tiền", subtitle: "Theo dõi phiếu thu và dòng tiền" },
    { test: (p) => p.startsWith("/expenses"), title: "Chi phí", subtitle: "Theo dõi chi phí vận hành theo ngày và tháng" },
    { test: (p) => p.startsWith("/notifications"), title: "Thông báo", subtitle: "Danh sách việc cần xử lý" },
    { test: (p) => p.startsWith("/outbound"), title: "Gọi nhắc", subtitle: "Hàng đợi và lịch sử nhắc học viên" },
    { test: (p) => p.startsWith("/admin/n8n"), title: "Luồng n8n", subtitle: "Tài liệu luồng tự động và runbook tích hợp" },
    { test: (p) => p.startsWith("/admin/automation-monitor"), title: "Giám sát luồng tự động", subtitle: "Theo dõi job, lỗi và nhật ký chạy trong ngày" },
    { test: (p) => p.startsWith("/api-hub"), title: "API Hub", subtitle: "Tra cứu API và cách đấu nối nhanh" },
    { test: (p) => p.startsWith("/admin"), title: "Quản trị", subtitle: "Thiết lập và vận hành hệ thống" },
  ];
  return map.find((item) => item.test(pathname)) || { title: APP_SHORT, subtitle: APP_DESCRIPTION };
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<MeResponse["user"] | null>(null);
  const [guardResult, setGuardResult] = useState<AuthGuardResult | null>(null);
  const guardStartedRef = useRef(false);

  const pageMeta = useMemo(() => guessPageTitle(pathname), [pathname]);
  const usePageMobileShell =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/leads") ||
    pathname.startsWith("/kpi/daily") ||
    pathname.startsWith("/ai/kpi-coach") ||
    pathname.startsWith("/kpi/targets") ||
    pathname.startsWith("/goals");

  useEffect(() => {
    if (guardStartedRef.current) return;
    guardStartedRef.current = true;
    let cancelled = false;

    guardByAuthMe(router)
      .then((result) => {
        if (cancelled) return;
        setGuardResult(result);
        if (result.state === "ok") setUser(result.user);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    document.title = `${pageMeta.title} | ${APP_SHORT}`;
  }, [pageMeta.title]);

  async function logout() {
    try {
      await logoutSession();
    } catch {
      // no-op
    }
    router.replace("/login");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100">
        <div className="flex items-center gap-2 text-zinc-700">
          <Spinner /> Đang tải...
        </div>
      </div>
    );
  }

  if (guardResult?.state === "forbidden") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 p-4">
        <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 text-center shadow-sm">
          <p className="text-base font-semibold text-zinc-900">Bạn không có quyền truy cập</p>
          <p className="mt-2 text-sm text-zinc-600">Liên hệ quản trị viên để được cấp quyền phù hợp.</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="secondary" onClick={() => router.replace("/dashboard")}>Về trang chủ</Button>
            <Button onClick={() => window.location.reload()}>Thử lại</Button>
          </div>
        </div>
      </div>
    );
  }

  if (guardResult?.state === "unauthorized") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 p-4">
        <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 text-center shadow-sm">
          <p className="text-base font-semibold text-zinc-900">Phiên đăng nhập không hợp lệ</p>
          <p className="mt-2 text-sm text-zinc-600">Đang chuyển đến trang đăng nhập...</p>
          <div className="mt-4 flex justify-center">
            <Button variant="secondary" onClick={() => router.replace("/login")}>Đăng nhập ngay</Button>
          </div>
        </div>
      </div>
    );
  }

  if (guardResult?.state === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 p-4">
        <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 text-center shadow-sm">
          <p className="text-base font-semibold text-zinc-900">Không thể tải phiên đăng nhập</p>
          <p className="mt-2 text-sm text-zinc-600">{guardResult.message}</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="secondary" onClick={() => router.replace("/login")}>Đăng nhập lại</Button>
            <Button onClick={() => window.location.reload()}>Thử lại</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-zinc-100/70">
        {/* Skip to content — visible on keyboard focus */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[9999] focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-zinc-900 focus:shadow-lg"
        >
          Bỏ qua điều hướng
        </a>
        <div className="flex min-h-screen">
          <DesktopSidebarMenu permissions={user?.permissions} isAdmin={Boolean(user && isAdminRole(user.role))} />

          <div className="min-w-0 flex-1">
            {!usePageMobileShell ? (
              <MobileTopbar
                title={pageMeta.title}
                subtitle={pageMeta.subtitle}
                rightAction={
                  <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                    {user ? roleLabel(user.role) : ""}
                  </span>
                }
              />
            ) : null}

            <header aria-label="Thanh điều hướng desktop" className="sticky top-0 z-30 hidden border-b border-zinc-200 bg-white/95 px-5 py-3 backdrop-blur md:block">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold tracking-tight text-slate-900">{pageMeta.title}</p>
                  <p className="text-xs text-zinc-500">{pageMeta.subtitle}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="hidden rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 lg:inline-flex">
                    {user ? `${user.name || user.email} • ${roleLabel(user.role)}` : ""}
                  </span>
                  <Button variant="secondary" onClick={logout}>Đăng xuất</Button>
                </div>
              </div>
            </header>

            <main id="main-content" className={`mx-auto w-full max-w-[1280px] px-3 py-3 ${usePageMobileShell ? "pb-6" : "pb-24"} md:p-5 md:pb-8`}>
              <ErrorBoundary>{children}</ErrorBoundary>
            </main>
          </div>
        </div>

        {!usePageMobileShell ? <MobileAdminMenu /> : null}
      </div>
    </ToastProvider>
  );
}
