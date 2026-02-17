import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCESS_TOKEN_COOKIE, STUDENT_ACCESS_TOKEN_COOKIE } from "@/lib/jwt";
import { isAllowlistedApiRoute, resolveRoutePermission } from "@/lib/route-permissions-map";

function isProtectedPath(pathname: string) {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/leads") ||
    pathname.startsWith("/kpi") ||
    pathname.startsWith("/goals") ||
    pathname.startsWith("/ai") ||
    pathname.startsWith("/students") ||
    pathname.startsWith("/schedule") ||
    pathname.startsWith("/courses") ||
    pathname.startsWith("/receipts") ||
    pathname.startsWith("/expenses") ||
    pathname.startsWith("/notifications") ||
    pathname.startsWith("/outbound") ||
    pathname.startsWith("/automation") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api-hub")
  );
}

function isStudentProtectedPath(pathname: string) {
  if (!pathname.startsWith("/student")) return false;
  if (pathname === "/student/login" || pathname === "/student/register") return false;
  return true;
}

function decodeJwtPayload(token: string) {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const decoded = JSON.parse(atob(padded)) as { exp?: number; role?: string };
    return decoded;
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method.toUpperCase();

  if (pathname.startsWith("/api")) {
    if (method === "OPTIONS") return NextResponse.next();
    if (isAllowlistedApiRoute(pathname, method)) return NextResponse.next();
    if (!resolveRoutePermission(pathname, method)) {
      return NextResponse.json(
        { ok: false, error: { code: "AUTH_FORBIDDEN", message: "Bạn không có quyền thực hiện" } },
        { status: 403 }
      );
    }
    return NextResponse.next();
  }

  if (!isProtectedPath(pathname) && !isStudentProtectedPath(pathname)) {
    return NextResponse.next();
  }

  if (isStudentProtectedPath(pathname)) {
    const studentToken = req.cookies.get(STUDENT_ACCESS_TOKEN_COOKIE)?.value || "";
    const crmToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value || "";
    const nowSec = Math.floor(Date.now() / 1000);

    // Allow if valid student token
    if (studentToken) {
      const payload = decodeJwtPayload(studentToken);
      if (payload?.exp && payload.exp > nowSec) return NextResponse.next();
    }

    // Also allow if valid CRM admin/staff token (e.g. admin viewing student portal)
    if (crmToken) {
      const payload = decodeJwtPayload(crmToken);
      if (payload?.exp && payload.exp > nowSec) return NextResponse.next();
    }

    const loginUrl = new URL("/student/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  const token = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value || "";
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  const payload = decodeJwtPayload(token);
  const nowSec = Math.floor(Date.now() / 1000);
  if (!payload?.exp || payload.exp <= nowSec) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/admin") && payload.role !== "admin") {
    // Page-level guard only: API routes independently verify JWT signatures.
    const leadsUrl = new URL("/leads", req.url);
    leadsUrl.searchParams.set("err", "forbidden");
    return NextResponse.redirect(leadsUrl);
  }

  if (pathname.startsWith("/automation/run") && payload.role !== "admin") {
    const leadsUrl = new URL("/leads", req.url);
    leadsUrl.searchParams.set("err", "forbidden");
    return NextResponse.redirect(leadsUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
