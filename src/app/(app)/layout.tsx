"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { logoutSession, type MeResponse } from "@/lib/auth-client";
import { isAdminRole } from "@/lib/admin-auth";
import { guardByAuthMe, type AuthGuardResult } from "@/lib/ui-auth-guard";
import { MobileAdminMenu } from "@/components/mobile/MobileAdminMenu";
import { MobileTopbar } from "@/components/mobile/MobileTopbar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { APP_DESCRIPTION, APP_NAME, APP_SHORT } from "@/lib/app-meta";
import { hasUiPermission, moduleKeyFromHref } from "@/lib/ui-permissions";

type NavItem = {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
};

function roleLabel(role: string) {
  if (role === "admin") return "Quản trị";
  if (role === "manager") return "Quản lý";
  if (role === "telesales") return "Tư vấn";
  if (role === "direct_page") return "Trực page";
  if (role === "viewer") return "Chỉ xem";
  return role;
}

const MAIN_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Tổng quan", match: (p) => p.startsWith("/dashboard") },
  { href: "/leads", label: "Khách hàng", match: (p) => (p === "/leads" || p.startsWith("/leads/")) && !p.startsWith("/leads/board") },
  { href: "/leads/board", label: "Bảng trạng thái", match: (p) => p.startsWith("/leads/board") },
  { href: "/kpi/daily", label: "KPI ngày", match: (p) => p.startsWith("/kpi/daily") },
  { href: "/ai/kpi-coach", label: "Trợ lý công việc", match: (p) => p.startsWith("/ai/kpi-coach") },
  { href: "/kpi/targets", label: "Mục tiêu KPI", match: (p) => p.startsWith("/kpi/targets") },
  { href: "/goals", label: "Mục tiêu ngày/tháng", match: (p) => p.startsWith("/goals") },
  { href: "/students", label: "Học viên", match: (p) => p === "/students" || p.startsWith("/students/") },
  { href: "/courses", label: "Khóa học", match: (p) => p === "/courses" || p.startsWith("/courses/") },
  { href: "/schedule", label: "Lịch học", match: (p) => p === "/schedule" || p.startsWith("/schedule/") },
  { href: "/receipts", label: "Thu tiền", match: (p) => p.startsWith("/receipts") },
  { href: "/expenses/monthly", label: "Chi phí", match: (p) => p.startsWith("/expenses") },
  { href: "/notifications", label: "Thông báo", match: (p) => p.startsWith("/notifications") },
  { href: "/outbound", label: "Gửi tin", match: (p) => p.startsWith("/outbound") },
  { href: "/me/payroll", label: "Lương tôi", match: (p) => p.startsWith("/me/payroll") },
];

const MARKETING_ITEMS: NavItem[] = [
  { href: "/marketing", label: "Báo cáo Meta Ads", match: (p) => p.startsWith("/marketing") },
];

const OPS_ITEMS: NavItem[] = [
  { href: "/admin/ops", label: "AI hỗ trợ nhân sự", match: (p) => p.startsWith("/admin/ops") },
  { href: "/admin/n8n", label: "Luồng n8n", match: (p) => p.startsWith("/admin/n8n") },
  { href: "/automation/logs", label: "Tự động hóa - Nhật ký", match: (p) => p.startsWith("/automation/logs") },
  { href: "/automation/run", label: "Tự động hóa - Chạy tay", match: (p) => p.startsWith("/automation/run") },
];

const ADMIN_ITEMS: NavItem[] = [
  { href: "/admin/guide", label: "Hướng dẫn vận hành", match: (p) => p.startsWith("/admin/guide") },
  { href: "/admin/huong-dan-ai", label: "Hướng dẫn Trợ lý công việc", match: (p) => p.startsWith("/admin/huong-dan-ai") },
  { href: "/admin/branches", label: "Chi nhánh", match: (p) => p.startsWith("/admin/branches") },
  { href: "/admin/users", label: "Người dùng", match: (p) => p.startsWith("/admin/users") },
  { href: "/admin/phan-quyen", label: "Phân quyền", match: (p) => p.startsWith("/admin/phan-quyen") },
  { href: "/api-hub", label: "API Hub", match: (p) => p.startsWith("/api-hub") },
  { href: "/admin/assign-leads", label: "Phân khách hàng", match: (p) => p.startsWith("/admin/assign-leads") },
  { href: "/admin/tuition-plans", label: "Bảng học phí", match: (p) => p.startsWith("/admin/tuition-plans") },
  { href: "/admin/notifications", label: "Quản trị thông báo", match: (p) => p.startsWith("/admin/notifications") },
  { href: "/admin/cron", label: "Vận hành tự động", match: (p) => p.startsWith("/admin/cron") },
  { href: "/admin/worker", label: "Tiến trình gửi tin", match: (p) => p.startsWith("/admin/worker") },
  { href: "/admin/scheduler", label: "Lập lịch", match: (p) => p.startsWith("/admin/scheduler") },
  { href: "/admin/student-content", label: "Nội dung học viên", match: (p) => p.startsWith("/admin/student-content") },
];

const HR_ITEMS: NavItem[] = [
  { href: "/hr/kpi", label: "KPI nhân sự", match: (p) => p.startsWith("/hr/kpi") },
  { href: "/hr/salary-profiles", label: "Hồ sơ lương", match: (p) => p.startsWith("/hr/salary-profiles") },
  { href: "/hr/attendance", label: "Chấm công", match: (p) => p.startsWith("/hr/attendance") },
  { href: "/hr/payroll", label: "Bảng lương", match: (p) => p.startsWith("/hr/payroll") },
];

function NavLink({ item, pathname, onClick }: { item: NavItem; pathname: string; onClick?: () => void }) {
  const active = item.match(pathname);
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`group relative block rounded-xl px-3 py-2 text-sm transition ${
        active
          ? "border border-amber-200 bg-slate-100 text-slate-900"
          : "border border-transparent text-zinc-700 hover:border-zinc-200 hover:bg-zinc-50"
      }`}
    >
      {active ? <span className="absolute left-1 top-2 bottom-2 w-1 rounded-full bg-amber-400" /> : null}
      <span className={active ? "ml-2 font-semibold" : "ml-2 font-medium"}>{item.label}</span>
    </Link>
  );
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
    { test: (p) => p.startsWith("/marketing"), title: "Marketing", subtitle: "Theo dõi chi phí và CPL Meta Ads" },
    { test: (p) => p.startsWith("/students"), title: "Học viên", subtitle: "Danh sách học viên và tiến độ học tập" },
    { test: (p) => p.startsWith("/courses"), title: "Khóa học", subtitle: "Quản lý khóa học và lịch đào tạo" },
    { test: (p) => p.startsWith("/schedule"), title: "Lịch học", subtitle: "Vận hành buổi học và điểm danh" },
    { test: (p) => p.startsWith("/receipts"), title: "Thu tiền", subtitle: "Theo dõi phiếu thu và dòng tiền" },
    { test: (p) => p.startsWith("/expenses/daily"), title: "Chi phí theo ngày", subtitle: "Nhập chi phí vận hành theo danh mục" },
    { test: (p) => p.startsWith("/expenses/monthly"), title: "Tổng hợp chi phí tháng", subtitle: "Theo dõi chi phí + lương cơ bản theo chi nhánh" },
    { test: (p) => p.startsWith("/notifications"), title: "Thông báo", subtitle: "Danh sách việc cần xử lý" },
    { test: (p) => p.startsWith("/outbound"), title: "Gửi tin", subtitle: "Hàng đợi và lịch sử nhắc học viên" },
    { test: (p) => p.startsWith("/me/payroll"), title: "Lương của tôi", subtitle: "Xem phiếu lương theo tháng" },
    { test: (p) => p.startsWith("/hr/kpi"), title: "KPI nhân sự", subtitle: "Thiết lập KPI theo nhân viên và thời gian hiệu lực" },
    { test: (p) => p.startsWith("/hr/salary-profiles"), title: "Hồ sơ lương", subtitle: "Quản lý mức lương theo nhân sự" },
    { test: (p) => p.startsWith("/hr/attendance"), title: "Chấm công", subtitle: "Theo dõi ngày công theo nhân sự" },
    { test: (p) => p.startsWith("/hr/payroll"), title: "Bảng lương", subtitle: "Tính và chốt lương theo kỳ" },
    { test: (p) => p.startsWith("/admin/ops"), title: "AI hỗ trợ nhân sự", subtitle: "Snapshot 10 phút và gợi ý ưu tiên xử lý" },
    { test: (p) => p.startsWith("/admin/n8n"), title: "Luồng n8n", subtitle: "Tài liệu workflow và runbook tích hợp" },
    { test: (p) => p.startsWith("/admin/phan-quyen"), title: "Phân quyền", subtitle: "Thiết lập nhóm quyền và override theo người dùng" },
    { test: (p) => p.startsWith("/admin/guide"), title: "Hướng dẫn vận hành", subtitle: "Tổng hợp module, quy trình và checklist theo vai trò" },
    { test: (p) => p.startsWith("/admin/huong-dan-ai"), title: "Hướng dẫn Trợ lý công việc", subtitle: "Cách đọc KPI phần trăm và dùng gợi ý hằng ngày" },
    { test: (p) => p.startsWith("/admin/branches"), title: "Chi nhánh", subtitle: "Quản trị danh sách chi nhánh" },
    { test: (p) => p.startsWith("/automation"), title: "Tự động hóa", subtitle: "Theo dõi tác vụ tự động" },
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
            <Button variant="secondary" onClick={() => router.replace("/dashboard")}>
              Về trang chủ
            </Button>
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
            <Button variant="secondary" onClick={() => router.replace("/login")}>
              Đăng nhập ngay
            </Button>
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
            <Button variant="secondary" onClick={() => router.replace("/login")}>
              Đăng nhập lại
            </Button>
            <Button onClick={() => window.location.reload()}>Thử lại</Button>
          </div>
        </div>
      </div>
    );
  }

  const isAdmin = user ? isAdminRole(user.role) : false;
  const canViewHref = (href: string) => {
    const moduleKey = moduleKeyFromHref(href);
    if (!moduleKey) return isAdmin;
    return hasUiPermission(user?.permissions, moduleKey, "VIEW");
  };
  const mainItems = MAIN_ITEMS.filter((item) => canViewHref(item.href));
  const opsItems = OPS_ITEMS.filter((item) => canViewHref(item.href));
  const marketingItems = MARKETING_ITEMS.filter((item) => canViewHref(item.href));
  const adminItems = ADMIN_ITEMS.filter((item) => canViewHref(item.href));
  const hrItems = HR_ITEMS.filter((item) => canViewHref(item.href));

  return (
    <div className="page min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-[1480px]">
        <aside className="hidden w-72 shrink-0 border-r border-[var(--border)] bg-zinc-50/80 px-4 py-5 lg:block">
          <div className="mb-6">
            <p className="text-lg font-semibold text-slate-900">{APP_NAME}</p>
            <p className="text-xs text-zinc-500">Bảng điều hành nội bộ</p>
          </div>

          <nav className="space-y-5">
            <div className="space-y-1">
              {mainItems.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} />
              ))}
            </div>

            {opsItems.length > 0 ? (
              <div>
              <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Vận hành</p>
              <div className="space-y-1">
                {opsItems.map((item) => (
                  <NavLink key={item.href} item={item} pathname={pathname} />
                ))}
              </div>
              </div>
            ) : null}

            {marketingItems.length > 0 ? (
              <div>
                <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Marketing</p>
                <div className="space-y-1">
                  {marketingItems.map((item) => (
                    <NavLink key={item.href} item={item} pathname={pathname} />
                  ))}
                </div>
              </div>
            ) : null}

            {adminItems.length > 0 ? (
              <div>
                <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Quản trị</p>
                <div className="space-y-1">
                  {adminItems.map((item) => (
                    <NavLink key={item.href} item={item} pathname={pathname} />
                  ))}
                </div>
              </div>
            ) : null}

            {hrItems.length > 0 ? (
              <div>
                <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Nhân sự</p>
                <div className="space-y-1">
                  {hrItems.map((item) => (
                    <NavLink key={item.href} item={item} pathname={pathname} />
                  ))}
                </div>
              </div>
            ) : null}
          </nav>
        </aside>

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

          <header className="sticky top-0 z-30 hidden border-b border-[var(--border)] bg-white/95 px-4 py-3 backdrop-blur md:px-5 lg:block">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold tracking-tight text-slate-900">{pageMeta.title}</p>
                <p className="text-xs text-zinc-500">{pageMeta.subtitle}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 md:inline-flex">
                  {user ? `${user.name || user.email} • ${roleLabel(user.role)}` : ""}
                </span>
                <Button variant="secondary" onClick={logout}>
                  Đăng xuất
                </Button>
              </div>
            </div>
          </header>

          <main
            className={`mx-auto w-full max-w-[1200px] px-3 py-3 ${usePageMobileShell ? "pb-6" : "pb-24"} md:p-5 md:pb-5 lg:p-6`}
          >
            {children}
          </main>
        </div>
      </div>

      {!usePageMobileShell ? <MobileAdminMenu /> : null}
    </div>
  );
}
