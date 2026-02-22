import { NextRequest, NextResponse } from "next/server";

/**
 * Next.js Middleware — Edge Runtime
 * 
 * 1. Auth guard: redirect to /login if no access_token cookie on protected routes
 * 2. Rate limiting: limit login attempts (in-memory, per IP)
 * 3. Security headers
 */

/* ── Rate limiter (in-memory, resets on deploy) ── */
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // max attempts
const RATE_WINDOW = 60_000; // 1 minute

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const entry = loginAttempts.get(ip);
    if (!entry || now > entry.resetAt) {
        loginAttempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
        return false;
    }
    entry.count++;
    return entry.count > RATE_LIMIT;
}

/* ── Protected route patterns ── */
const PROTECTED_PAGE_PATHS = [
    "/dashboard",
    "/leads",
    "/students",
    "/receipts",
    "/schedule",
    "/courses",
    "/expenses",
    "/kpi",
    "/hr",
    "/goals",
    "/notifications",
    "/outbound",
    "/marketing",
    "/automation",
    "/me",
    "/ai",
    "/api-hub",
    "/admin",
];

const PUBLIC_API_PATHS = [
    "/api/auth/login",
    "/api/auth/refresh",
    "/api/auth/logout",
    "/api/student/auth",
    "/api/public/",
    "/api/health",
    "/api/docs",
    "/api/webhooks/",
    "/api/meta/",
    "/api/cron/",
];

function isPublicApi(pathname: string): boolean {
    return PUBLIC_API_PATHS.some(p => pathname.startsWith(p));
}

function isProtectedPage(pathname: string): boolean {
    return PROTECTED_PAGE_PATHS.some(p => pathname.startsWith(p));
}

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    /* ── Rate limit login ── */
    if (pathname === "/api/auth/login" && request.method === "POST") {
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
            || request.headers.get("x-real-ip")
            || "unknown";
        if (isRateLimited(ip)) {
            return NextResponse.json(
                { error: { code: "RATE_LIMITED", message: "Quá nhiều lần đăng nhập. Vui lòng thử lại sau 1 phút." } },
                { status: 429 }
            );
        }
    }

    /* ── Auth guard for protected pages ── */
    if (isProtectedPage(pathname)) {
        const token = request.cookies.get("access_token")?.value;
        if (!token) {
            const loginUrl = new URL("/login", request.url);
            loginUrl.searchParams.set("redirect", pathname);
            return NextResponse.redirect(loginUrl);
        }
    }

    /* ── Auth guard for protected APIs ── */
    if (pathname.startsWith("/api/") && !isPublicApi(pathname)) {
        const token = request.cookies.get("access_token")?.value;
        const bearer = request.headers.get("authorization");
        const workerSecret = request.headers.get("x-worker-secret");
        const serviceToken = request.headers.get("x-service-token");

        if (!token && !bearer && !workerSecret && !serviceToken) {
            return NextResponse.json(
                { error: { code: "AUTH_UNAUTHENTICATED", message: "Chưa đăng nhập" } },
                { status: 401 }
            );
        }
    }

    /* ── Security headers ── */
    const response = NextResponse.next();
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all paths except:
         * - _next/static (static files)
         * - _next/image (image optimization)
         * - favicon.ico, icons, images
         * - public files
         */
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|css|js)$).*)",
    ],
};
