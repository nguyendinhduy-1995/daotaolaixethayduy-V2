"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { clearToken, fetchMe, getToken, type MeResponse } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<MeResponse["user"] | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    fetchMe()
      .then((data) => setUser(data.user))
      .catch(() => {
        clearToken();
        router.replace("/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

  function logout() {
    clearToken();
    router.replace("/login");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100">
        <div className="flex items-center gap-2 text-zinc-700">
          <Spinner /> Loading...
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
              href="/leads"
              className={`block rounded-lg px-3 py-2 text-sm ${pathname.startsWith("/leads") ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`}
            >
              Leads
            </Link>
            <Link
              href="/kpi/daily"
              className={`block rounded-lg px-3 py-2 text-sm ${pathname.startsWith("/kpi/daily") ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`}
            >
              KPI Daily
            </Link>
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
            <div className="lg:hidden">
              <Link href="/leads" className="text-sm font-semibold text-zinc-900">
                ThayDuy CRM
              </Link>
            </div>
            <div className="text-sm text-zinc-600">{user ? `${user.name || user.email} (${user.role})` : ""}</div>
            <Button variant="secondary" onClick={logout}>
              Logout
            </Button>
          </header>
          <main className="flex-1 p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
