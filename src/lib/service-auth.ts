import crypto from "crypto";
import { jsonError } from "@/lib/api-response";

const REPLAY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Verify service-to-service auth:
 * 1. x-service-token must match SERVICE_TOKEN env
 * 2. X-Signature = HMAC-SHA256(body, HMAC_SECRET)
 * 3. X-Timestamp within 5 min window
 *
 * Returns { ok: true, body } or { ok: false, response }
 */
export async function verifyServiceAuth(
    req: Request
): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
    const serviceToken = req.headers.get("x-service-token") ?? "";
    const expectedToken = process.env.SERVICE_TOKEN ?? "";

    if (!expectedToken || serviceToken !== expectedToken) {
        return { ok: false, response: jsonError(401, "AUTH_INVALID_TOKEN", "Invalid service token") };
    }

    // Timestamp check
    const tsHeader = req.headers.get("x-timestamp") ?? "";
    const ts = parseInt(tsHeader, 10);
    if (!ts || Math.abs(Date.now() - ts) > REPLAY_WINDOW_MS) {
        return { ok: false, response: jsonError(401, "AUTH_REPLAY", "Request timestamp out of range") };
    }

    // Read body
    const rawBody = await req.text();
    let body: unknown;
    try {
        body = JSON.parse(rawBody);
    } catch {
        return { ok: false, response: jsonError(400, "INVALID_JSON", "Invalid JSON body") };
    }

    // HMAC verification
    const hmacSecret = process.env.CRM_HMAC_SECRET ?? process.env.SERVICE_TOKEN ?? "";
    const signature = req.headers.get("x-signature") ?? "";
    const expectedSig = crypto
        .createHmac("sha256", hmacSecret)
        .update(rawBody)
        .digest("hex");

    if (!signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
        return { ok: false, response: jsonError(401, "AUTH_INVALID_SIGNATURE", "Invalid HMAC signature") };
    }

    return { ok: true, body };
}
