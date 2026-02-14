import type { Prisma } from "@prisma/client";
import { isAdminRole, isTelesalesRole } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-response";

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

export function extractScheduleMeta(rule: unknown) {
  if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
    return { location: "", note: "", status: "" };
  }
  const obj = rule as Record<string, unknown>;
  return {
    location: typeof obj.location === "string" ? obj.location : "",
    note: typeof obj.note === "string" ? obj.note : "",
    status: typeof obj.status === "string" ? obj.status : "",
  };
}

export function requireScheduleRole(role: string) {
  if (isAdminRole(role) || isTelesalesRole(role)) return null;
  return jsonError(403, "AUTH_FORBIDDEN", "Forbidden");
}

export function buildScheduleScopeWhere(auth: { sub: string; role: string }): Prisma.CourseScheduleItemWhereInput {
  if (isAdminRole(auth.role)) return {};
  return {
    course: {
      students: {
        some: {
          lead: {
            ownerId: auth.sub,
          },
        },
      },
    },
  };
}
