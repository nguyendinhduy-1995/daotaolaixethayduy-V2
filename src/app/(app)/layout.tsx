"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { clearToken, fetchMe, logoutSession, type MeResponse } from "@/lib/auth-client";
import { isAdminRole } from "@/lib/admin-auth";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

function roleLabel(role: string) {
  if (role === "admin") return "Quản trị";
  if (role === "manager") return "Quản lý";
  if (role === "telesales") return "Telesale";
  if (role === "direct_page") return "Trực page";
  if (role === "viewer") return "Chỉ xem";
  return role;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<MeResponse["user"] | null>(null);

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

  return (
    <div className="min-h-screen bg-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-[1400px]">
        <aside className="hidden w-64 border-r border-zinc-200 bg-white p-4 lg:block">
          <h1 className="mb-6 text-lg font-semibold text-zinc-900">ThayDuy CRM</h1>
          <nav className="space-y-2">
            <Link
              href="/dashboard"
              className={`block rounded-lg px-3 py-2 text-sm ${pathname.startsWith("/dashboard") ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`}
            >
              Tổng quan
            </Link>
            <Link
              href="/leads"
              className={`block rounded-lg px-3 py-2 text-sm ${pathname === "/leads" || pathname.startsWith("/leads/") && !pathname.startsWith("/leads/board") ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`}
            >
              Khách hàng
            </Link>
            <Link
              href="/leads/board"
              className={`block rounded-lg px-3 py-2 text-sm ${pathname.startsWith("/leads/board") ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`}
            >
              Bảng Kanban
            </Link>
            <Link
              href="/kpi/daily"
              className={`block rounded-lg px-3 py-2 text-sm ${pathname.startsWith("/kpi/daily") ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`}
            >
              KPI ngày
            </Link>
            <Link
              href="/receipts"
              className={`block rounded-lg px-3 py-2 text-sm ${pathname.startsWith("/receipts") ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`}
            >
              Thu tiền
            </Link>
            <Link
              href="/students"
              className={`block rounded-lg px-3 py-2 text-sm ${pathname === "/students" || pathname.startsWith("/students/") ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`}
            >
              Học viên
            </Link>
            <Link
              href="/courses"
              className={`block rounded-lg px-3 py-2 text-sm ${pathname === "/courses" || pathname.startsWith("/courses/") ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`}
            >
              Khóa học
            </Link>
            <Link
              href="/notifications"
              className={`block rounded-lg px-3 py-2 text-sm ${pathname === "/notifications" || pathname.startsWith("/notifications/") ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`}
            >
              Thông báo
            </Link>
            <Link
              href="/outbound"
              className={`block rounded-lg px-3 py-2 text-sm ${pathname === "/outbound" || pathname.startsWith("/outbound/") ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`}
            >
              Gửi tin
            </Link>
            <div className="pt-2">
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Vận hành</p>
              <Link
                href="/automation/logs"
                className={`block rounded-lg px-3 py-2 text-sm ${pathname.startsWith("/automation/logs") ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`}
              >
                Automation - Nhật ký
              </Link>
              {user && isAdminRole(user.role) ? (
                <Link
                  href="/automation/run"
                  className={`block rounded-lg px-3 py-2 text-sm ${pathname.startsWith("/automation/run") ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`}
                >
                  Automation - Chạy tay
                </Link>
              ) : null}
            </div>
            {user && isAdminRole(user.role) ? (
              <div className="pt-2">
                <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Quản trị</p>
                <Link
                  href="/admin/users"
                  className={`block rounded-lg px-3 py-2 text-sm ${pathname.startsWith("/admin/users") ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`}
                >
                  Người dùng
                </Link>
                <Link
                  href="/admin/assign-leads"
                  className={`block rounded-lg px-3 py-2 text-sm ${pathname.startsWith("/admin/assign-leads") ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`}
                >
                  Phân khách hàng
                </Link>
                <Link
                  href="/admin/tuition-plans"
                  className={`block rounded-lg px-3 py-2 text-sm ${pathname.startsWith("/admin/tuition-plans") ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`}
                >
                  Bảng học phí
                </Link>
                <Link
                  href="/admin/notifications"
                  className={`block rounded-lg px-3 py-2 text-sm ${pathname.startsWith("/admin/notifications") ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`}
                >
                  Quản trị thông báo
                </Link>
              </div>
            ) : null}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
            <div className="lg:hidden">
              <Link href="/dashboard" className="text-sm font-semibold text-zinc-900">
                ThayDuy CRM
              </Link>
            </div>
            <div className="text-sm text-zinc-600">{user ? `${user.name || user.email} (${roleLabel(user.role)})` : ""}</div>
            <Button variant="secondary" onClick={logout}>
              Đăng xuất
            </Button>
          </header>
          <main className="flex-1 p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
