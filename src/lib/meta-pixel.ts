/**
 * Meta Pixel + CAPI dedup helper.
 * Usage: trackMetaEvent("Lead", { content_name: "LeadForm" }, { phone: "09..." })
 * 
 * - Generates unique event_id for dedup
 * - Sends Browser Pixel (fbq) + Server CAPI simultaneously
 * - Handles _fbc cookie from fbclid
 */

declare global {
    interface Window {
        fbq?: (...args: unknown[]) => void;
    }
}

function getCookie(name: string): string | null {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Set _fbc cookie if URL contains fbclid and _fbc doesn't exist yet.
 * Format: fb.1.<creation_time>.<fbclid>
 */
export function ensureFbcCookie(): void {
    if (typeof window === "undefined") return;

    // Check if _fbc already exists
    if (getCookie("_fbc")) return;

    const url = new URL(window.location.href);
    const fbclid = url.searchParams.get("fbclid");
    if (!fbclid) return;

    const fbc = `fb.1.${Date.now()}.${fbclid}`;
    const expires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString(); // 90 days
    document.cookie = `_fbc=${fbc}; path=/; expires=${expires}; SameSite=Lax`;
}

/**
 * Track a Meta standard event with Browser Pixel + Server CAPI dedup.
 */
export function trackMetaEvent(
    eventName: string,
    customData?: Record<string, unknown>,
    userData?: { email?: string; phone?: string },
): void {
    // Ensure _fbc is set
    ensureFbcCookie();

    // Generate unique event_id for dedup
    const eventId = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    // 1. Browser Pixel
    if (typeof window !== "undefined" && window.fbq) {
        try {
            window.fbq("track", eventName, customData || {}, { eventID: eventId });
        } catch (e) {
            console.warn("[meta-pixel] fbq error:", e);
        }
    }

    // 2. Server CAPI (fire and forget)
    try {
        fetch("/api/meta/capi", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                event_name: eventName,
                event_id: eventId,
                event_source_url: typeof window !== "undefined" ? window.location.href : "",
                email: userData?.email,
                phone: userData?.phone,
                custom_data: customData,
            }),
            keepalive: true,
        }).catch(() => undefined);
    } catch {
        // Silently fail — don't block user experience
    }
}
