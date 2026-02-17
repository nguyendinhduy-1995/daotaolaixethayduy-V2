/**
 * Shared date utilities for Ho Chi Minh timezone operations.
 * Replaces duplicate implementations in ai-kpi-coach.ts, expenses.ts, ops-pulse.ts.
 */

const HCM_TZ = process.env.OPS_TZ?.trim() || "Asia/Ho_Chi_Minh";

/** Returns { year, month, day, dateKey } for today in HCM timezone */
export function todayInHoChiMinh() {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: HCM_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(now);
    const year = parts.find((p) => p.type === "year")!.value;
    const month = parts.find((p) => p.type === "month")!.value;
    const day = parts.find((p) => p.type === "day")!.value;
    const dateKey = `${year}-${month}-${day}`;
    return { year: Number(year), month: Number(month), day: Number(day), dateKey };
}

/** Returns UTC start/end for a single day in HCM timezone (YYYY-MM-DD) */
export function dayRangeInHoChiMinh(dateKey: string) {
    const start = new Date(`${dateKey}T00:00:00.000+07:00`);
    const end = new Date(`${dateKey}T23:59:59.999+07:00`);
    return { start, end };
}

/** Returns UTC start/end for a month in HCM timezone (YYYY-MM) */
export function monthRangeInHoChiMinh(monthKey: string) {
    const [year, month] = monthKey.split("-").map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1, -7, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 0, 16, 59, 59, 999));
    return { start, end };
}

/** Validates YYYY-MM-DD format */
export function isYmd(value: string) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Validates YYYY-MM format */
export function isYm(value: string) {
    return /^\d{4}-\d{2}$/.test(value);
}

/** Add days to a date */
export function addDays(date: Date, days: number) {
    return new Date(date.getTime() + days * 86_400_000);
}
