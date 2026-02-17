"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo } from "react";
import { APP_SHORT } from "@/lib/app-meta";

const NAV = [
  { href: "/student", label: "Tổng quan", icon: "🏠" },
  { href: "/student/schedule", label: "Lịch học", icon: "📅" },
  { href: "/student/content", label: "Tài liệu", icon: "📄" },
  { href: "/student/finance", label: "Học phí", icon: "💰" },
];

export default function StudentLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthPage = useMemo(() => pathname === "/student/login" || pathname === "/student/register", [pathname]);

  useEffect(() => {
    document.title = isAuthPage ? `${APP_SHORT} | Đăng nhập học viên` : `${APP_SHORT} | Cổng học viên`;
  }, [isAuthPage]);

  async function logout() {
    await fetch("/api/student/auth/logout", { method: "POST", credentials: "include" }).catch(() => undefined);
    router.replace("/student/login");
  }

  if (isAuthPage) return <>{children}</>;

  return (
    <div className="relative min-h-screen bg-slate-50">
      {/* Decorative blur blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-amber-400/[0.06] blur-3xl" />
        <div className="absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-slate-900/[0.04] blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-amber-400/[0.04] blur-3xl" />
      </div>

      {/* Navy header */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-sm font-bold text-slate-900">
              TD
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Cổng học viên</p>
              <p className="text-xs text-slate-400">{APP_SHORT}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700 hover:text-white"
            aria-label="Đăng xuất tài khoản học viên"
          >
            Đăng xuất
          </button>
        </div>
      </header>

      {/* Sticky nav tabs */}
      <nav className="sticky top-[57px] z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1120px] gap-1 overflow-x-auto px-3 py-2 md:px-5">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all ${active
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  }`}
              >
                <span className="text-xs">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Content */}
      <main className="relative mx-auto max-w-[1120px] px-4 py-5 md:px-6 md:py-6">{children}</main>
    </div>
  );
}
