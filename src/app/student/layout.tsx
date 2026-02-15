"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useMemo } from "react";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/student", label: "Tổng quan" },
  { href: "/student/schedule", label: "Lịch học" },
  { href: "/student/content", label: "Tài liệu" },
  { href: "/student/finance", label: "Học phí" },
];

export default function StudentLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthPage = useMemo(() => pathname === "/student/login" || pathname === "/student/register", [pathname]);

  async function logout() {
    await fetch("/api/student/auth/logout", { method: "POST", credentials: "include" }).catch(() => undefined);
    router.replace("/student/login");
  }

  if (isAuthPage) return <>{children}</>;

  return (
    <div className="min-h-screen bg-zinc-100/80">
      <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-base font-semibold text-zinc-900">Cổng học viên</p>
            <p className="text-xs text-zinc-500">Tổng quan học tập</p>
          </div>
          <Button type="button" variant="secondary" onClick={logout} aria-label="Đăng xuất tài khoản học viên">
            Đăng xuất
          </Button>
        </div>
      </header>
      <nav className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-3 py-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                pathname === item.href
                  ? "bg-zinc-900 text-white shadow-sm"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
      <main className="mx-auto max-w-6xl p-4 md:p-6">{children}</main>
    </div>
  );
}
