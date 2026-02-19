"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo } from "react";
import { APP_SHORT } from "@/lib/app-meta";
import { TrackingScriptsClient } from "@/components/tracking/TrackingScriptsClient";

/* ─── SVG icons for BottomNav (24×24 outline + filled pairs) ─── */
function IconHome({ filled }: { filled?: boolean }) {
  return filled ? (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
      <path d="M11.47 3.841a.75.75 0 0 1 1.06 0l8.69 8.69a.75.75 0 0 1-1.06 1.06l-.97-.97V19.5a1.5 1.5 0 0 1-1.5 1.5h-3a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 0-.75-.75h-1.5a.75.75 0 0 0-.75.75v4.5a.75.75 0 0 1-.75.75h-3a1.5 1.5 0 0 1-1.5-1.5v-6.568l-.97.969a.75.75 0 1 1-1.06-1.06l8.69-8.69Z" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955a1.126 1.126 0 0 1 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  );
}

function IconCalendar({ filled }: { filled?: boolean }) {
  return filled ? (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
      <path d="M12.75 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM7.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A5.971 5.971 0 0 1 6 10.5h.026A5.97 5.97 0 0 1 7.5 12.075V15.75Zm4.5 0a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0V12a1.5 1.5 0 0 0-1.5-1.5H9v.002A5.97 5.97 0 0 1 12 12.075V15.75Zm4.5 0a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0V12.75m-12-6.975v1.2a1.5 1.5 0 1 0 3 0V5.775m0 0V3.75m0 2.025h.002M6.75 3.75H4.875c-.621 0-1.125.504-1.125 1.125v1.2a1.5 1.5 0 1 0 3 0V3.75Zm0 0H6m.75 0h3m3 0h.008m-.008 0H12m.75 0h3m3 0h.008M12.75 3.75h3.375c.621 0 1.125.504 1.125 1.125v1.2a1.5 1.5 0 1 1-3 0V3.75Z" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
  );
}

function IconDocument({ filled }: { filled?: boolean }) {
  return filled ? (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
      <path fillRule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625ZM7.5 15a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 7.5 15Zm.75 2.25a.75.75 0 0 0 0 1.5H12a.75.75 0 0 0 0-1.5H8.25Z" clipRule="evenodd" />
      <path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  );
}

function IconWallet({ filled }: { filled?: boolean }) {
  return filled ? (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
      <path d="M2.273 5.625A4.483 4.483 0 0 1 5.25 4.5h13.5c1.141 0 2.183.425 2.977 1.125A3 3 0 0 0 18.75 3H5.25a3 3 0 0 0-2.977 2.625ZM2.273 8.625A4.483 4.483 0 0 1 5.25 7.5h13.5c1.141 0 2.183.425 2.977 1.125A3 3 0 0 0 18.75 6H5.25a3 3 0 0 0-2.977 2.625ZM5.25 9a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h13.5a3 3 0 0 0 3-3v-6a3 3 0 0 0-3-3H15a.75.75 0 0 0-.75.75 2.25 2.25 0 0 1-4.5 0A.75.75 0 0 0 9 9H5.25Z" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" />
    </svg>
  );
}

const NAV = [
  { href: "/student", label: "Tổng quan", Icon: IconHome },
  { href: "/student/schedule", label: "Lịch học", Icon: IconCalendar },
  { href: "/student/content", label: "Tài liệu", Icon: IconDocument },
  { href: "/student/finance", label: "Học phí", Icon: IconWallet },
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
        <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-3 px-4 py-2.5 md:px-6 md:py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500 text-xs font-bold text-slate-900 md:h-9 md:w-9 md:text-sm">
              TD
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Cổng học viên</p>
              <p className="hidden text-xs text-slate-400 md:block">{APP_SHORT}</p>
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

      {/* Desktop nav tabs — hidden on mobile (BottomNav replaces) */}
      <nav className="sticky top-[49px] z-20 hidden border-b border-slate-200/80 bg-white/90 backdrop-blur-md md:block md:top-[57px]">
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
                <item.Icon filled={active} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Content — extra bottom padding on mobile for BottomNav */}
      <main className="relative mx-auto max-w-[1120px] px-4 pb-24 pt-5 md:px-6 md:pb-6 md:pt-6">{children}</main>

      {/* ═══ Mobile BottomNav ═══ */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 backdrop-blur-lg md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="mx-auto flex max-w-md items-stretch">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex flex-1 flex-col items-center gap-0.5 pb-2 pt-2.5 text-[10px] font-semibold transition-colors ${active ? "text-amber-600" : "text-slate-400 active:text-slate-600"
                  }`}
              >
                {/* Active indicator dot */}
                {active && (
                  <span className="absolute top-0 left-1/2 h-[3px] w-6 -translate-x-1/2 rounded-b-full bg-amber-500" />
                )}
                <item.Icon filled={active} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <TrackingScriptsClient site="STUDENT" />
    </div>
  );
}
