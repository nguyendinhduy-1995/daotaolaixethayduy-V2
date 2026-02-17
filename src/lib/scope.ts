import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type ScopeMode = "SYSTEM" | "BRANCH" | "OWNER";

export type AccessScope = {
  mode: ScopeMode;
  branchId?: string;
  ownerId?: string;
};

export function whereOwnerScope<T extends Record<string, unknown>>(user: { sub: string }, extraWhere: T) {
  return { AND: [extraWhere, { ownerId: user.sub }] } as unknown as T;
}

export async function getAllowedBranchIds(user: { sub: string; role: string }) {
  const role = user.role.toLowerCase();
  if (role === "admin") {
    const rows = await prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true },
      orderBy: { name: "asc" },
    });
    return rows.map((row) => row.id);
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.sub },
    select: { branchId: true },
  });
  return dbUser?.branchId ? [dbUser.branchId] : [];
}

export async function enforceBranchScope(
  branchId: string | null | undefined,
  user: { sub: string; role: string },
  preResolvedAllowedIds?: string[]
) {
  if (!branchId) return null;
  const allowed = preResolvedAllowedIds ?? (await getAllowedBranchIds(user));
  if (!allowed.includes(branchId)) return null;
  return branchId;
}

export async function whereBranchScope<T extends Record<string, unknown>>(
  user: { sub: string; role: string },
  extraWhere: T
) {
  const role = user.role.toLowerCase();
  if (role === "admin") return extraWhere;
  const allowed = await getAllowedBranchIds(user);
  if (allowed.length === 0) {
    return { AND: [extraWhere, { branchId: "__NO_ACCESS__" }] } as unknown as T;
  }
  return { AND: [extraWhere, { branchId: { in: allowed } }] } as unknown as T;
}

export async function resolveWriteBranchId(
  user: { sub: string; role: string },
  candidates: Array<string | null | undefined> = []
) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const scoped = await enforceBranchScope(candidate, user);
    if (scoped) return scoped;
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.sub },
    select: { branchId: true },
  });
  if (dbUser?.branchId) return dbUser.branchId;

  const defaultByCode = await prisma.branch.findFirst({
    where: { code: "DEFAULT" },
    select: { id: true },
  });
  if (defaultByCode?.id) return defaultByCode.id;

  const anyBranch = await prisma.branch.findFirst({
    where: { isActive: true },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (anyBranch?.id) return anyBranch.id;

  const created = await prisma.branch.create({
    data: { id: "__DEFAULT_BRANCH__", name: "Chi nhánh mặc định", code: "DEFAULT", isActive: true },
    select: { id: true },
  });
  return created.id;
}

export async function resolveScope(user: { sub: string; role: string }): Promise<AccessScope> {
  const role = user.role.toLowerCase();
  if (role === "admin") return { mode: "SYSTEM" };

  const dbUser = await prisma.user.findUnique({
    where: { id: user.sub },
    select: { branchId: true },
  });

  if (role === "manager") {
    if (dbUser?.branchId) return { mode: "BRANCH", branchId: dbUser.branchId };
    return { mode: "OWNER", ownerId: user.sub };
  }

  if (role === "telesales" || role === "direct_page") {
    return { mode: "OWNER", ownerId: user.sub, branchId: dbUser?.branchId ?? undefined };
  }

  if (dbUser?.branchId) return { mode: "BRANCH", branchId: dbUser.branchId };
  return { mode: "OWNER", ownerId: user.sub };
}

function withAnd<T extends Prisma.LeadWhereInput | Prisma.StudentWhereInput | Prisma.ReceiptWhereInput | Prisma.CourseScheduleItemWhereInput>(
  where: T,
  extra: T
): T {
  const base = where && Object.keys(where as Record<string, unknown>).length > 0 ? [where] : [];
  return { AND: [...base, extra] } as T;
}

export function applyScopeToWhere(
  where: Prisma.LeadWhereInput,
  scope: AccessScope,
  entityType: "lead"
): Prisma.LeadWhereInput;
export function applyScopeToWhere(
  where: Prisma.StudentWhereInput,
  scope: AccessScope,
  entityType: "student"
): Prisma.StudentWhereInput;
export function applyScopeToWhere(
  where: Prisma.ReceiptWhereInput,
  scope: AccessScope,
  entityType: "receipt"
): Prisma.ReceiptWhereInput;
export function applyScopeToWhere(
  where: Prisma.CourseScheduleItemWhereInput,
  scope: AccessScope,
  entityType: "schedule"
): Prisma.CourseScheduleItemWhereInput;
export function applyScopeToWhere(
  where:
    | Prisma.LeadWhereInput
    | Prisma.StudentWhereInput
    | Prisma.ReceiptWhereInput
    | Prisma.CourseScheduleItemWhereInput,
  scope: AccessScope,
  entityType: "lead" | "student" | "receipt" | "schedule"
) {
  if (scope.mode === "SYSTEM") return where;

  if (entityType === "lead") {
    if (scope.mode === "OWNER" && scope.ownerId) {
      const ownerWhere: Prisma.LeadWhereInput = { ownerId: scope.ownerId };
      if (scope.branchId) {
        return withAnd(where as Prisma.LeadWhereInput, { AND: [ownerWhere, { branchId: scope.branchId }] });
      }
      return withAnd(where as Prisma.LeadWhereInput, ownerWhere);
    }
    if (scope.mode === "BRANCH" && scope.branchId) {
      return withAnd(where as Prisma.LeadWhereInput, { branchId: scope.branchId });
    }
    return where;
  }

  if (entityType === "student") {
    if (scope.mode === "OWNER" && scope.ownerId) {
      const ownerWhere: Prisma.StudentWhereInput = { lead: { ownerId: scope.ownerId } };
      if (scope.branchId) {
        return withAnd(where as Prisma.StudentWhereInput, { AND: [ownerWhere, { branchId: scope.branchId }] });
      }
      return withAnd(where as Prisma.StudentWhereInput, ownerWhere);
    }
    if (scope.mode === "BRANCH" && scope.branchId) {
      return withAnd(where as Prisma.StudentWhereInput, { branchId: scope.branchId });
    }
    return where;
  }

  if (entityType === "receipt") {
    if (scope.mode === "OWNER" && scope.ownerId) {
      const ownerWhere: Prisma.ReceiptWhereInput = { student: { lead: { ownerId: scope.ownerId } } };
      if (scope.branchId) {
        return withAnd(where as Prisma.ReceiptWhereInput, { AND: [ownerWhere, { branchId: scope.branchId }] });
      }
      return withAnd(where as Prisma.ReceiptWhereInput, ownerWhere);
    }
    if (scope.mode === "BRANCH" && scope.branchId) {
      return withAnd(where as Prisma.ReceiptWhereInput, { branchId: scope.branchId });
    }
    return where;
  }

  if (scope.mode === "BRANCH" && scope.branchId) {
    return withAnd(where as Prisma.CourseScheduleItemWhereInput, { branchId: scope.branchId });
  }
  if (scope.mode === "OWNER" && scope.ownerId) {
    const ownerWhere: Prisma.CourseScheduleItemWhereInput = {
      course: { students: { some: { lead: { ownerId: scope.ownerId } } } },
    };
    if (scope.branchId) {
      return withAnd(where as Prisma.CourseScheduleItemWhereInput, { AND: [ownerWhere, { branchId: scope.branchId }] });
    }
    return withAnd(where as Prisma.CourseScheduleItemWhereInput, ownerWhere);
  }
  return where;
}
