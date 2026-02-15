import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCESS_TOKEN_COOKIE, STUDENT_ACCESS_TOKEN_COOKIE } from "@/lib/jwt";

function isProtectedPath(pathname: string) {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/leads") ||
    pathname.startsWith("/kpi") ||
    pathname.startsWith("/students") ||
    pathname.startsWith("/schedule") ||
    pathname.startsWith("/courses") ||
    pathname.startsWith("/receipts") ||
    pathname.startsWith("/notifications") ||
    pathname.startsWith("/outbound") ||
    pathname.startsWith("/automation") ||
    pathname.startsWith("/admin")
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

  if (!isProtectedPath(pathname) && !isStudentProtectedPath(pathname)) {
    return NextResponse.next();
  }

  if (isStudentProtectedPath(pathname)) {
    const token = req.cookies.get(STUDENT_ACCESS_TOKEN_COOKIE)?.value || "";
    if (!token) {
      const loginUrl = new URL("/student/login", req.url);
      return NextResponse.redirect(loginUrl);
    }
    const payload = decodeJwtPayload(token);
    const nowSec = Math.floor(Date.now() / 1000);
    if (!payload?.exp || payload.exp <= nowSec) {
      const loginUrl = new URL("/student/login", req.url);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
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

  if (pathname.startsWith("/admin")) {
    return verifyAdminAccess(req, payload?.role);
  }

  if (pathname.startsWith("/automation/run") && payload.role !== "admin") {
    const leadsUrl = new URL("/leads", req.url);
    leadsUrl.searchParams.set("err", "forbidden");
    return NextResponse.redirect(leadsUrl);
  }

  return NextResponse.next();
}

async function verifyAdminAccess(req: NextRequest, decodedRole?: string) {
  // Do not trust decoded JWT role claim for authorization decisions.
  // Confirm session with server-side auth verification (/api/auth/me).
  const meRes = await fetch(new URL("/api/auth/me", req.url), {
    method: "GET",
    headers: {
      cookie: req.headers.get("cookie") ?? "",
    },
  }).catch(() => null);

  if (!meRes?.ok) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  const meJson = (await meRes.json().catch(() => null)) as { user?: { role?: string } } | null;
  const role = meJson?.user?.role ?? decodedRole;
  if (role !== "admin") {
    const leadsUrl = new URL("/leads", req.url);
    leadsUrl.searchParams.set("err", "forbidden");
    return NextResponse.redirect(leadsUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
