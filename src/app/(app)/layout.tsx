"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { clearToken, fetchMe, logoutSession, type MeResponse } from "@/lib/auth-client";
import { isAdminRole } from "@/lib/admin-auth";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type NavItem = {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
};

function roleLabel(role: string) {
  if (role === "admin") return "Quản trị";
  if (role === "manager") return "Quản lý";
  if (role === "telesales") return "Telesale";
  if (role === "direct_page") return "Trực page";
  if (role === "viewer") return "Chỉ xem";
  return role;
}

const MAIN_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Tổng quan", match: (p) => p.startsWith("/dashboard") },
  { href: "/leads", label: "Khách hàng", match: (p) => (p === "/leads" || p.startsWith("/leads/")) && !p.startsWith("/leads/board") },
  { href: "/leads/board", label: "Bảng Kanban", match: (p) => p.startsWith("/leads/board") },
  { href: "/kpi/daily", label: "KPI ngày", match: (p) => p.startsWith("/kpi/daily") },
  { href: "/students", label: "Học viên", match: (p) => p === "/students" || p.startsWith("/students/") },
  { href: "/courses", label: "Khóa học", match: (p) => p === "/courses" || p.startsWith("/courses/") },
  { href: "/schedule", label: "Lịch học", match: (p) => p === "/schedule" || p.startsWith("/schedule/") },
  { href: "/receipts", label: "Thu tiền", match: (p) => p.startsWith("/receipts") },
  { href: "/notifications", label: "Thông báo", match: (p) => p.startsWith("/notifications") },
  { href: "/outbound", label: "Gửi tin", match: (p) => p.startsWith("/outbound") },
];

const OPS_ITEMS: NavItem[] = [
  { href: "/automation/logs", label: "Tự động hóa - Nhật ký", match: (p) => p.startsWith("/automation/logs") },
  { href: "/automation/run", label: "Tự động hóa - Chạy tay", match: (p) => p.startsWith("/automation/run") },
];

const ADMIN_ITEMS: NavItem[] = [
  { href: "/admin/users", label: "Người dùng", match: (p) => p.startsWith("/admin/users") },
  { href: "/admin/assign-leads", label: "Phân khách hàng", match: (p) => p.startsWith("/admin/assign-leads") },
  { href: "/admin/tuition-plans", label: "Bảng học phí", match: (p) => p.startsWith("/admin/tuition-plans") },
  { href: "/admin/notifications", label: "Quản trị thông báo", match: (p) => p.startsWith("/admin/notifications") },
  { href: "/admin/cron", label: "Vận hành tự động", match: (p) => p.startsWith("/admin/cron") },
  { href: "/admin/worker", label: "Tiến trình gửi tin", match: (p) => p.startsWith("/admin/worker") },
  { href: "/admin/scheduler", label: "Lập lịch", match: (p) => p.startsWith("/admin/scheduler") },
  { href: "/admin/student-content", label: "Nội dung học viên", match: (p) => p.startsWith("/admin/student-content") },
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
    { test: (p) => p.startsWith("/leads/board"), title: "Bảng Kanban", subtitle: "Theo dõi pipeline khách hàng theo trạng thái" },
    { test: (p) => p.startsWith("/leads"), title: "Khách hàng", subtitle: "Quản lý danh sách và lịch sử tương tác" },
    { test: (p) => p.startsWith("/kpi/daily"), title: "KPI ngày", subtitle: "Báo cáo chỉ số theo thời gian" },
    { test: (p) => p.startsWith("/students"), title: "Học viên", subtitle: "Danh sách học viên và tiến độ học tập" },
    { test: (p) => p.startsWith("/courses"), title: "Khóa học", subtitle: "Quản lý khóa học và lịch đào tạo" },
    { test: (p) => p.startsWith("/schedule"), title: "Lịch học", subtitle: "Vận hành buổi học và điểm danh" },
    { test: (p) => p.startsWith("/receipts"), title: "Thu tiền", subtitle: "Theo dõi phiếu thu và dòng tiền" },
    { test: (p) => p.startsWith("/notifications"), title: "Thông báo", subtitle: "Danh sách việc cần xử lý" },
    { test: (p) => p.startsWith("/outbound"), title: "Gửi tin", subtitle: "Hàng đợi và lịch sử nhắc học viên" },
    { test: (p) => p.startsWith("/automation"), title: "Tự động hóa", subtitle: "Theo dõi tác vụ tự động" },
    { test: (p) => p.startsWith("/admin"), title: "Quản trị", subtitle: "Thiết lập và vận hành hệ thống" },
  ];
  return map.find((item) => item.test(pathname)) || { title: "CRM", subtitle: "Điều hành hệ thống" };
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<MeResponse["user"] | null>(null);

  const pageMeta = useMemo(() => guessPageTitle(pathname), [pathname]);

  useEffect(() => {
    fetchMe()
      .then((data) => setUser(data.user))
      .catch(() => {
        clearToken();
        router.replace("/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

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

  const isAdmin = user ? isAdminRole(user.role) : false;

  return (
    <div className="min-h-screen bg-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-[1480px]">
        <aside className="hidden w-72 shrink-0 border-r border-zinc-200 bg-white px-4 py-5 lg:block">
          <div className="mb-6">
            <p className="text-lg font-semibold text-slate-900">Thầy Duy CRM</p>
            <p className="text-xs text-zinc-500">Bảng điều hành nội bộ</p>
          </div>

          <nav className="space-y-5">
            <div className="space-y-1">
              {MAIN_ITEMS.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} />
              ))}
            </div>

            <div>
              <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Vận hành</p>
              <div className="space-y-1">
                {OPS_ITEMS.filter((item) => isAdmin || item.href === "/automation/logs").map((item) => (
                  <NavLink key={item.href} item={item} pathname={pathname} />
                ))}
              </div>
            </div>

            {isAdmin ? (
              <div>
                <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Quản trị</p>
                <div className="space-y-1">
                  {ADMIN_ITEMS.map((item) => (
                    <NavLink key={item.href} item={item} pathname={pathname} />
                  ))}
                </div>
              </div>
            ) : null}
          </nav>
        </aside>

        {menuOpen ? (
          <div className="fixed inset-0 z-40 bg-black/35 lg:hidden" onClick={() => setMenuOpen(false)} aria-hidden="true" />
        ) : null}

        <aside
          className={`fixed inset-y-0 left-0 z-50 w-72 border-r border-zinc-200 bg-white px-4 py-5 shadow-xl transition-transform lg:hidden ${
            menuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-base font-semibold text-slate-900">Thầy Duy CRM</p>
              <p className="text-xs text-zinc-500">Điều hướng nhanh</p>
            </div>
            <Button variant="ghost" onClick={() => setMenuOpen(false)}>
              Đóng
            </Button>
          </div>

          <nav className="space-y-4 overflow-y-auto pb-6">
            <div className="space-y-1">
              {MAIN_ITEMS.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} onClick={() => setMenuOpen(false)} />
              ))}
            </div>

            <div>
              <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Vận hành</p>
              <div className="space-y-1">
                {OPS_ITEMS.filter((item) => isAdmin || item.href === "/automation/logs").map((item) => (
                  <NavLink key={item.href} item={item} pathname={pathname} onClick={() => setMenuOpen(false)} />
                ))}
              </div>
            </div>

            {isAdmin ? (
              <div>
                <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Quản trị</p>
                <div className="space-y-1">
                  {ADMIN_ITEMS.map((item) => (
                    <NavLink key={item.href} item={item} pathname={pathname} onClick={() => setMenuOpen(false)} />
                  ))}
                </div>
              </div>
            ) : null}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur md:px-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button variant="secondary" className="lg:hidden" onClick={() => setMenuOpen(true)}>
                  Mở menu
                </Button>
                <div>
                  <p className="text-base font-semibold text-slate-900">{pageMeta.title}</p>
                  <p className="text-xs text-zinc-500">{pageMeta.subtitle}</p>
                </div>
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

          <main className="mx-auto w-full max-w-[1200px] p-4 md:p-5 lg:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
