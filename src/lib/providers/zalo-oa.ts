/**
 * Zalo OA Provider — sendZNS, sendText, rate limiting, retry
 *
 * Env vars needed:
 *   ZALO_OA_APP_ID       — Zalo OA App ID
 *   ZALO_OA_SECRET_KEY   — Zalo OA Secret Key
 *   ZALO_OA_ACCESS_TOKEN — Zalo OA Access Token
 *   ZALO_OA_DRY_RUN      — "true" to enable dry run mode
 */
import type {
    ZNSRequest,
    ZNSResponse,
    OATextRequest,
    OATextResponse,
    ZaloOAConfig,
    DeliveryStatus,
} from "./zalo-oa-types";

const ZNS_API = "https://business.openapi.zalo.me/message/template";
const OA_TEXT_API = "https://openapi.zalo.me/v3.0/oa/message/cs";

// ─── Singleton config ───────────────────────────────────────────
let _config: ZaloOAConfig | null = null;

function getConfig(): ZaloOAConfig {
    if (_config) return _config;
    _config = {
        appId: process.env.ZALO_OA_APP_ID || "",
        secretKey: process.env.ZALO_OA_SECRET_KEY || "",
        accessToken: process.env.ZALO_OA_ACCESS_TOKEN || "",
        refreshToken: process.env.ZALO_OA_REFRESH_TOKEN || "",
        dryRun: process.env.ZALO_OA_DRY_RUN === "true",
        maxRetries: 3,
        retryDelayMs: 30_000,
        dailyLimit: 500,
    };
    return _config;
}

// ─── Rate limiter (in-memory, reset daily) ──────────────────────
let _dailySentCount = 0;
let _dailyResetDate = "";

function checkRateLimit(): boolean {
    const today = new Date().toISOString().slice(0, 10);
    if (_dailyResetDate !== today) {
        _dailySentCount = 0;
        _dailyResetDate = today;
    }
    return _dailySentCount < getConfig().dailyLimit;
}

function incrementSentCount() {
    _dailySentCount++;
}

// ─── Helper: retry with exponential backoff ─────────────────────
async function withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number,
    baseDelayMs: number,
): Promise<T> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            if (attempt < maxRetries) {
                const delay = baseDelayMs * Math.pow(2, attempt);
                console.warn(`[ZaloOA] Retry ${attempt + 1}/${maxRetries} after ${delay}ms:`, lastError.message);
                await new Promise((r) => setTimeout(r, delay));
            }
        }
    }
    throw lastError!;
}

// ─── Format phone to 84xxx ──────────────────────────────────────
function formatPhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("84")) return cleaned;
    if (cleaned.startsWith("0")) return "84" + cleaned.slice(1);
    return "84" + cleaned;
}

// ─── Send ZNS Template Message ──────────────────────────────────
export interface SendZNSResult {
    success: boolean;
    messageId: string | null;
    status: DeliveryStatus;
    errorCode: number | null;
    errorMessage: string | null;
    dryRun: boolean;
}

export async function sendZNS(req: ZNSRequest): Promise<SendZNSResult> {
    const config = getConfig();

    // Dry run mode
    if (config.dryRun) {
        console.log("[ZaloOA:DryRun] sendZNS →", JSON.stringify(req));
        return {
            success: true,
            messageId: `dry-run-${Date.now()}`,
            status: "SENT",
            errorCode: null,
            errorMessage: null,
            dryRun: true,
        };
    }

    // Rate limit check
    if (!checkRateLimit()) {
        return {
            success: false,
            messageId: null,
            status: "REJECTED",
            errorCode: 429,
            errorMessage: `Daily limit reached (${config.dailyLimit}/day)`,
            dryRun: false,
        };
    }

    // Validate config
    if (!config.accessToken) {
        return {
            success: false,
            messageId: null,
            status: "FAILED",
            errorCode: -1,
            errorMessage: "ZALO_OA_ACCESS_TOKEN not configured",
            dryRun: false,
        };
    }

    const phone = formatPhone(req.phone);

    return withRetry(async () => {
        const res = await fetch(ZNS_API, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                access_token: config.accessToken,
            },
            body: JSON.stringify({
                phone,
                template_id: req.templateId,
                template_data: req.templateData,
                tracking_id: req.trackingId || `crm-${Date.now()}`,
            }),
        });

        const data: ZNSResponse = await res.json();

        if (data.error === 0) {
            incrementSentCount();
            return {
                success: true,
                messageId: data.data?.msg_id || null,
                status: "SENT" as DeliveryStatus,
                errorCode: null,
                errorMessage: null,
                dryRun: false,
            };
        }

        // Non-retryable errors
        if (data.error === -201 || data.error === -204) {
            return {
                success: false,
                messageId: null,
                status: "REJECTED" as DeliveryStatus,
                errorCode: data.error,
                errorMessage: data.message,
                dryRun: false,
            };
        }

        // Retryable — throw to trigger retry
        throw new Error(`ZNS error ${data.error}: ${data.message}`);
    }, config.maxRetries, config.retryDelayMs);
}

// ─── Send OA Text Message ───────────────────────────────────────
export async function sendText(
    recipientId: string,
    text: string,
): Promise<SendZNSResult> {
    const config = getConfig();

    if (config.dryRun) {
        console.log("[ZaloOA:DryRun] sendText →", { recipientId, text: text.slice(0, 100) });
        return {
            success: true,
            messageId: `dry-run-text-${Date.now()}`,
            status: "SENT",
            errorCode: null,
            errorMessage: null,
            dryRun: true,
        };
    }

    if (!checkRateLimit()) {
        return {
            success: false,
            messageId: null,
            status: "REJECTED",
            errorCode: 429,
            errorMessage: `Daily limit reached (${config.dailyLimit}/day)`,
            dryRun: false,
        };
    }

    if (!config.accessToken) {
        return {
            success: false,
            messageId: null,
            status: "FAILED",
            errorCode: -1,
            errorMessage: "ZALO_OA_ACCESS_TOKEN not configured",
            dryRun: false,
        };
    }

    return withRetry(async () => {
        const res = await fetch(OA_TEXT_API, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                access_token: config.accessToken,
            },
            body: JSON.stringify({
                recipient: { user_id: recipientId },
                message: { text },
            }),
        });

        const data: OATextResponse = await res.json();

        if (data.error === 0) {
            incrementSentCount();
            return {
                success: true,
                messageId: data.data?.message_id || null,
                status: "SENT" as DeliveryStatus,
                errorCode: null,
                errorMessage: null,
                dryRun: false,
            };
        }

        throw new Error(`OA text error ${data.error}: ${data.message}`);
    }, config.maxRetries, config.retryDelayMs);
}

// ─── Check if ZaloOA is configured ──────────────────────────────
export function isZaloOAConfigured(): boolean {
    const config = getConfig();
    return !!(config.accessToken && config.appId);
}

// ─── Get rate limit status ──────────────────────────────────────
export function getRateLimitStatus(): { sent: number; limit: number; remaining: number } {
    const config = getConfig();
    const today = new Date().toISOString().slice(0, 10);
    if (_dailyResetDate !== today) {
        return { sent: 0, limit: config.dailyLimit, remaining: config.dailyLimit };
    }
    return {
        sent: _dailySentCount,
        limit: config.dailyLimit,
        remaining: config.dailyLimit - _dailySentCount,
    };
}
