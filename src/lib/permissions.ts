import type { PermissionAction as PrismaPermissionAction, PermissionModule as PrismaPermissionModule } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { ACTION_KEYS, MODULE_KEYS, type ActionKey, type ModuleKey } from "@/lib/permission-keys";

export { ACTION_KEYS, MODULE_KEYS };
export type { ActionKey, ModuleKey };

export type PermissionUser = {
  sub: string;
  role: string;
};

type PermissionMatrix = Partial<Record<ModuleKey, ActionKey[]>>;
export type PermissionSet = Set<string>;

const FULL_ACTIONS: ActionKey[] = [...ACTION_KEYS];
const VIEW_ONLY: ActionKey[] = ["VIEW"];

function makePermissionKey(moduleKey: ModuleKey, action: ActionKey) {
  return `${moduleKey}:${action}`;
}

function buildPermissionSet(matrix: PermissionMatrix): PermissionSet {
  const set = new Set<string>();
  for (const moduleKey of MODULE_KEYS) {
    const actions = matrix[moduleKey] || [];
    for (const action of actions) {
      set.add(makePermissionKey(moduleKey, action));
    }
  }
  return set;
}

function allModulesWith(actions: ActionKey[]) {
  const matrix: PermissionMatrix = {};
  for (const moduleKey of MODULE_KEYS) {
    matrix[moduleKey] = actions;
  }
  return matrix;
}

function mergeMatrix(base: PermissionMatrix, next: PermissionMatrix): PermissionMatrix {
  const out: PermissionMatrix = { ...base };
  for (const moduleKey of MODULE_KEYS) {
    if (next[moduleKey]) out[moduleKey] = next[moduleKey];
  }
  return out;
}

const ADMIN_DEFAULT = allModulesWith(FULL_ACTIONS);

const MANAGER_DEFAULT: PermissionMatrix = {
  overview: ["VIEW", "EXPORT"],
  leads: ["VIEW", "CREATE", "UPDATE", "ASSIGN", "EXPORT"],
  leads_board: ["VIEW", "UPDATE", "ASSIGN"],
  kpi_daily: ["VIEW", "EXPORT"],
  kpi_targets: ["VIEW", "EDIT"],
  goals: ["VIEW", "EDIT"],
  ai_kpi_coach: ["VIEW", "CREATE", "UPDATE"],
  students: ["VIEW", "CREATE", "UPDATE", "EXPORT"],
  courses: ["VIEW", "CREATE", "UPDATE", "EXPORT"],
  schedule: ["VIEW", "CREATE", "UPDATE", "EXPORT"],
  receipts: ["VIEW", "CREATE", "UPDATE", "EXPORT"],
  notifications: ["VIEW", "CREATE", "UPDATE"],
  messaging: ["VIEW", "CREATE", "UPDATE", "RUN"],
  my_payroll: ["VIEW"],
  ops_ai_hr: ["VIEW"],
  ops_n8n: ["VIEW"],
  automation_logs: ["VIEW", "CREATE", "EXPORT"],
  automation_run: ["VIEW", "RUN"],
  marketing_meta_ads: ["VIEW", "EXPORT"],
  admin_branches: ["VIEW"],
  admin_users: ["VIEW"],
  admin_segments: ["VIEW", "ASSIGN"],
  admin_tuition: ["VIEW", "UPDATE"],
  admin_notification_admin: ["VIEW", "UPDATE"],
  admin_automation_admin: ["VIEW", "RUN"],
  admin_send_progress: ["VIEW", "RUN"],
  admin_plans: ["VIEW", "RUN"],
  admin_student_content: ["VIEW", "CREATE", "UPDATE"],
  hr_kpi: ["VIEW", "EXPORT"],
  hr_payroll_profiles: ["VIEW"],
  hr_attendance: ["VIEW"],
  hr_total_payroll: ["VIEW", "EXPORT"],
  api_hub: ["VIEW"],
  expenses: ["VIEW", "EDIT"],
  salary: ["VIEW", "EDIT"],
  insights: ["VIEW"],
};

const TELESALES_DEFAULT: PermissionMatrix = {
  overview: VIEW_ONLY,
  leads: ["VIEW", "CREATE", "UPDATE"],
  leads_board: ["VIEW", "UPDATE"],
  kpi_daily: VIEW_ONLY,
  kpi_targets: VIEW_ONLY,
  goals: VIEW_ONLY,
  ai_kpi_coach: VIEW_ONLY,
  students: ["VIEW", "CREATE", "UPDATE"],
  courses: VIEW_ONLY,
  schedule: ["VIEW", "CREATE", "UPDATE"],
  receipts: ["VIEW", "CREATE", "UPDATE"],
  notifications: ["VIEW", "UPDATE"],
  messaging: ["VIEW", "CREATE", "RUN"],
  my_payroll: VIEW_ONLY,
  automation_logs: VIEW_ONLY,
  marketing_meta_ads: VIEW_ONLY,
  api_hub: VIEW_ONLY,
  expenses: VIEW_ONLY,
  salary: VIEW_ONLY,
  insights: VIEW_ONLY,
};

const DIRECT_PAGE_DEFAULT: PermissionMatrix = mergeMatrix(TELESALES_DEFAULT, {
  messaging: ["VIEW", "CREATE"],
  receipts: ["VIEW", "CREATE"],
  my_payroll: VIEW_ONLY,
});

const VIEWER_DEFAULT: PermissionMatrix = {
  overview: VIEW_ONLY,
  kpi_daily: VIEW_ONLY,
  kpi_targets: VIEW_ONLY,
  goals: VIEW_ONLY,
  ai_kpi_coach: VIEW_ONLY,
  notifications: VIEW_ONLY,
  my_payroll: VIEW_ONLY,
  api_hub: VIEW_ONLY,
  expenses: VIEW_ONLY,
  salary: VIEW_ONLY,
  insights: VIEW_ONLY,
};

export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionSet> = {
  admin: buildPermissionSet(ADMIN_DEFAULT),
  manager: buildPermissionSet(MANAGER_DEFAULT),
  telesales: buildPermissionSet(TELESALES_DEFAULT),
  direct_page: buildPermissionSet(DIRECT_PAGE_DEFAULT),
  viewer: buildPermissionSet(VIEWER_DEFAULT),
};

function getDefaultSetByRole(role: string): PermissionSet {
  return new Set(DEFAULT_ROLE_PERMISSIONS[role.toLowerCase()] || DEFAULT_ROLE_PERMISSIONS.viewer);
}

function applyRules(
  current: PermissionSet,
  rules: Array<{ module: PrismaPermissionModule | string; action: PrismaPermissionAction | string; allowed: boolean }>
): PermissionSet {
  const next = new Set(current);
  for (const rule of rules) {
    const moduleKey = String(rule.module) as ModuleKey;
    const action = String(rule.action) as ActionKey;
    if (!MODULE_KEYS.includes(moduleKey) || !ACTION_KEYS.includes(action)) continue;
    const key = makePermissionKey(moduleKey, action);
    if (rule.allowed) next.add(key);
    else next.delete(key);
  }
  return next;
}

export async function getEffectivePermissions(user: PermissionUser): Promise<PermissionSet> {
  const permissions = getDefaultSetByRole(user.role);

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.sub },
      select: {
        groupId: true,
        permissionOverrides: {
          select: { module: true, action: true, allowed: true },
        },
      },
    });

    if (!dbUser) return permissions;

    let effective = permissions;
    if (dbUser.groupId) {
      const groupRules = await prisma.permissionRule.findMany({
        where: { groupId: dbUser.groupId },
        select: { module: true, action: true, allowed: true },
      });
      effective = applyRules(effective, groupRules);
    }

    effective = applyRules(effective, dbUser.permissionOverrides);
    return effective;
  } catch {
    // Tương thích ngược khi DB chưa migrate RBAC: fallback theo role mặc định.
    return permissions;
  }
}

export function hasPermission(input: {
  user: PermissionUser;
  module: ModuleKey;
  action: ActionKey;
  permissions?: PermissionSet;
}): boolean {
  const set = input.permissions || getDefaultSetByRole(input.user.role);
  return set.has(makePermissionKey(input.module, input.action));
}

export function requirePermission(input: {
  user: PermissionUser;
  module: ModuleKey;
  action: ActionKey;
  permissions?: PermissionSet;
}) {
  if (hasPermission(input)) return null;
  return jsonError(403, "AUTH_FORBIDDEN", API_ERROR_VI.forbidden);
}

export function serializePermissions(set: PermissionSet) {
  return [...set].sort();
}
