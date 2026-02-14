"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useMemo } from "react";

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
    <div className="min-h-screen bg-zinc-100">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <p className="text-sm font-semibold text-zinc-900">Cổng học viên</p>
          <button onClick={logout} className="rounded-lg border border-zinc-300 px-3 py-1 text-sm text-zinc-700">
            Đăng xuất
          </button>
        </div>
      </header>
      <nav className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-3 py-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap rounded-lg px-3 py-1 text-sm ${pathname === item.href ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
      <main className="mx-auto max-w-5xl p-4">{children}</main>
    </div>
  );
}
