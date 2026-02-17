import type { Prisma } from "@prisma/client";
import { isAdminRole, isTelesalesRole } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-response";
import { applyScopeToWhere, resolveScope } from "@/lib/scope";

export type ScheduleStatusFilter = "upcoming" | "ongoing" | "done" | "inactive";

export function parsePositiveInt(value: string | null, fallback: number, max = 100) {
  if (value === null) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error("INVALID_PAGINATION");
  return Math.min(n, max);
}

export function parseDateYmd(value: string | null) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("INVALID_DATE");
  return value;
}

export function dayRangeHcm(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00.000+07:00`);
  const end = new Date(`${dateStr}T23:59:59.999+07:00`);
  return { start, end };
}

export function resolveScheduleStatus(item: {
  startAt: Date;
  endAt: Date | null;
  isActive: boolean;
}): ScheduleStatusFilter {
  if (!item.isActive) return "inactive";
  const now = Date.now();
  const start = item.startAt.getTime();
  const end = item.endAt ? item.endAt.getTime() : start + 2 * 60 * 60 * 1000;
  if (now < start) return "upcoming";
  if (now > end) return "done";
  return "ongoing";
}

type ScheduleMetaFallback = {
  location?: string | null;
  note?: string | null;
  status?: string | null;
  source?: string | null;
};

export function extractScheduleMeta(rule: unknown, fallback?: ScheduleMetaFallback) {
  if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
    return {
      location: fallback?.location || "",
      note: fallback?.note || "",
      status: fallback?.status || "",
      source: fallback?.source || "",
    };
  }
  const obj = rule as Record<string, unknown>;
  return {
    location: fallback?.location ?? (typeof obj.location === "string" ? obj.location : ""),
    note: fallback?.note ?? (typeof obj.note === "string" ? obj.note : ""),
    status: fallback?.status ?? (typeof obj.status === "string" ? obj.status : ""),
    source: fallback?.source ?? (typeof obj.source === "string" ? obj.source : ""),
  };
}

export function requireScheduleRole(role: string) {
  if (isAdminRole(role) || isTelesalesRole(role)) return null;
  return jsonError(403, "AUTH_FORBIDDEN", "Forbidden");
}

export async function buildScheduleScopeWhere(auth: { sub: string; role: string }): Promise<Prisma.CourseScheduleItemWhereInput> {
  const scope = await resolveScope(auth);
  return applyScopeToWhere({}, scope, "schedule");
}
