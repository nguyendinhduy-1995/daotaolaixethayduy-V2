/**
 * Shared environment variable utilities.
 * Replaces duplicate envInt() implementations in cron-daily.ts, outbound-worker.ts.
 */

/** Parse an env variable as a positive integer with a fallback */
export function envInt(name: string, fallback: number) {
    const raw = process.env[name];
    if (!raw) return fallback;
    const v = Number(raw);
    if (!Number.isInteger(v) || v <= 0) return fallback;
    return v;
}
