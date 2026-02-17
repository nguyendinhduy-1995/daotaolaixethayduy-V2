/**
 * Shared hash/stable-stringify utilities.
 * Replaces duplicate implementations in ai-kpi-coach.ts, idempotency.ts.
 */

import crypto from "node:crypto";

/** Deterministic JSON stringify (sorted object keys) for consistent hashing */
export function stableStringify(value: unknown): string {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

/** SHA-256 hash of a stable-stringified value */
export function hashPayload(value: unknown) {
    return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}
