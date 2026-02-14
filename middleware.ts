import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCESS_TOKEN_COOKIE } from "@/lib/jwt";

function isProtectedPath(pathname: string) {
  return (
    pathname.startsWith("/leads") ||
    pathname.startsWith("/kpi") ||
    pathname.startsWith("/students") ||
    pathname.startsWith("/courses") ||
    pathname.startsWith("/receipts") ||
    pathname.startsWith("/automation") ||
    pathname.startsWith("/admin")
  );
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

  if (!isProtectedPath(pathname)) {
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

  if (pathname.startsWith("/admin") && payload.role !== "admin") {
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
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
