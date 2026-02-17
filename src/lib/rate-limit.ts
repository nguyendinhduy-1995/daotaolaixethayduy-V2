/**
 * Simple in-memory rate limiter (per-IP, sliding window).
 * Good enough for single-instance deployment.
 * For multi-instance, replace with Redis-backed rate limiting.
 */

type Entry = { count: number; resetAt: number };

const stores = new Map<string, Map<string, Entry>>();

export interface RateLimitConfig {
    /** Unique name for this limiter (e.g. "login") */
    name: string;
    /** Max requests allowed in the window */
    maxRequests: number;
    /** Window duration in seconds */
    windowSec: number;
}

function getStore(name: string) {
    let store = stores.get(name);
    if (!store) {
        store = new Map();
        stores.set(name, store);
    }
    return store;
}

/**
 * Extract client IP from request headers.
 * Works with Vercel, Cloudflare, and direct connections.
 */
function getClientIp(req: Request): string {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim();
    const realIp = req.headers.get("x-real-ip");
    if (realIp) return realIp.trim();
    return "unknown";
}

/**
 * Check rate limit for a request. Returns null if OK,
 * or a Response (429) if limit exceeded.
 */
export function checkRateLimit(
    req: Request,
    config: RateLimitConfig
): Response | null {
    const ip = getClientIp(req);
    const store = getStore(config.name);
    const now = Date.now();

    // Cleanup old entries every 100 checks
    if (Math.random() < 0.01) {
        for (const [key, entry] of store) {
            if (entry.resetAt < now) store.delete(key);
        }
    }

    const entry = store.get(ip);

    if (!entry || entry.resetAt < now) {
        // New window
        store.set(ip, { count: 1, resetAt: now + config.windowSec * 1000 });
        return null;
    }

    entry.count++;

    if (entry.count > config.maxRequests) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        return new Response(
            JSON.stringify({
                ok: false,
                error: {
                    code: "RATE_LIMITED",
                    message: `Quá nhiều yêu cầu. Vui lòng thử lại sau ${retryAfter} giây.`,
                },
            }),
            {
                status: 429,
                headers: {
                    "Content-Type": "application/json",
                    "Retry-After": String(retryAfter),
                },
            }
        );
    }

    return null;
}
