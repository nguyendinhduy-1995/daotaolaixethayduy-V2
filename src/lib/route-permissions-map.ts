import type { ActionKey, ModuleKey } from "@/lib/permission-keys";

export type RoutePermissionRule = {
  method: string;
  pattern: RegExp;
  module: ModuleKey;
  action: ActionKey;
};

export const PUBLIC_API_ROUTES: Array<{ method?: string; pattern: RegExp }> = [
  { pattern: /^\/api\/health(\/|$)/ },
  { pattern: /^\/api\/auth(\/|$)/ },
  { method: "POST", pattern: /^\/api\/student\/auth\/login$/ },
  { method: "POST", pattern: /^\/api\/student\/auth\/register$/ },
  { method: "POST", pattern: /^\/api\/student\/auth\/logout$/ },
  { method: "GET", pattern: /^\/api\/student\/me$/ },
  { method: "GET", pattern: /^\/api\/student\/content$/ },
  { pattern: /^\/api\/templates(\/|$)/ },
  { method: "GET", pattern: /^\/api\/public\/tuition-plans$/ },
  { method: "POST", pattern: /^\/api\/public\/lead$/ },
  { method: "POST", pattern: /^\/api\/public\/seed-tuition$/ },
  { method: "GET", pattern: /^\/api\/tracking-codes$/ },
];

export const SECRET_AUTH_ROUTES: Array<{ method?: string; pattern: RegExp }> = [
  { method: "POST", pattern: /^\/api\/outbound\/callback$/ },
  { method: "POST", pattern: /^\/api\/marketing\/ingest$/ },
  { method: "POST", pattern: /^\/api\/marketing\/report$/ },
  { method: "POST", pattern: /^\/api\/ops\/pulse$/ },
  { method: "POST", pattern: /^\/api\/cron\/daily$/ },
  { method: "POST", pattern: /^\/api\/worker\/outbound$/ },
  { method: "POST", pattern: /^\/api\/insights\/expenses\/ingest$/ },
  { method: "POST", pattern: /^\/api\/ai\/suggestions\/ingest$/ },
  { method: "PATCH", pattern: /^\/api\/outbound\/jobs\/[^/]+$/ },
  { method: "POST", pattern: /^\/api\/automation\/logs\/ingest$/ },
  { method: "POST", pattern: /^\/api\/student-progress\/daily$/ },
  { method: "POST", pattern: /^\/api\/student-progress\/attempt$/ },
  { method: "POST", pattern: /^\/api\/student-progress\/ai-summary$/ },
  { method: "POST", pattern: /^\/api\/student-progress\/events$/ },
];

export const ROUTE_PERMISSION_RULES: RoutePermissionRule[] = [
  { method: "GET", pattern: /^\/api\/kpi\/daily$/, module: "kpi_daily", action: "VIEW" },
  { method: "GET", pattern: /^\/api\/kpi\/targets$/, module: "kpi_targets", action: "VIEW" },
  { method: "POST", pattern: /^\/api\/kpi\/targets$/, module: "kpi_targets", action: "EDIT" },
  { method: "GET", pattern: /^\/api\/goals$/, module: "goals", action: "VIEW" },
  { method: "POST", pattern: /^\/api\/goals$/, module: "goals", action: "EDIT" },
  { method: "GET", pattern: /^\/api\/ai\/suggestions$/, module: "ai_suggestions", action: "VIEW" },
  { method: "POST", pattern: /^\/api\/ai\/suggestions$/, module: "ai_suggestions", action: "CREATE" },
  { method: "POST", pattern: /^\/api\/ai\/suggestions\/[^/]+\/feedback$/, module: "ai_suggestions", action: "FEEDBACK" },
  { method: "GET", pattern: /^\/api\/ai\/suggestions\/analytics$/, module: "ai_suggestions", action: "VIEW" },
  { method: "GET", pattern: /^\/api\/ai\/suggestions\/summary$/, module: "ai_suggestions", action: "VIEW" },
  { method: "GET", pattern: /^\/api\/ai\/suggestions\/trend$/, module: "ai_suggestions", action: "VIEW" },
  { method: "GET", pattern: /^\/api\/tasks$/, module: "notifications", action: "VIEW" },
  { method: "POST", pattern: /^\/api\/tasks$/, module: "notifications", action: "CREATE" },
  { method: "PATCH", pattern: /^\/api\/tasks\/[^/]+$/, module: "notifications", action: "UPDATE" },
  { method: "GET", pattern: /^\/api\/me\/payroll$/, module: "my_payroll", action: "VIEW" },

  { method: "GET", pattern: /^\/api\/users$/, module: "admin_users", action: "VIEW" },
  { method: "POST", pattern: /^\/api\/users$/, module: "admin_users", action: "CREATE" },
  { method: "GET", pattern: /^\/api\/users\/[^/]+$/, module: "admin_users", action: "VIEW" },
  { method: "PATCH", pattern: /^\/api\/users\/[^/]+$/, module: "admin_users", action: "UPDATE" },

  { method: "GET", pattern: /^\/api\/admin\/users$/, module: "admin_users", action: "VIEW" },
  { method: "POST", pattern: /^\/api\/admin\/users$/, module: "admin_users", action: "CREATE" },
  { method: "GET", pattern: /^\/api\/admin\/users\/[^/]+$/, module: "admin_users", action: "VIEW" },
  { method: "PATCH", pattern: /^\/api\/admin\/users\/[^/]+$/, module: "admin_users", action: "UPDATE" },
  { method: "POST", pattern: /^\/api\/admin\/users\/bulk-toggle$/, module: "admin_users", action: "UPDATE" },

  { method: "GET", pattern: /^\/api\/admin\/branches$/, module: "admin_branches", action: "VIEW" },
  { method: "POST", pattern: /^\/api\/admin\/branches$/, module: "admin_branches", action: "CREATE" },
  { method: "PATCH", pattern: /^\/api\/admin\/branches\/[^/]+$/, module: "admin_branches", action: "UPDATE" },
  { method: "DELETE", pattern: /^\/api\/admin\/branches\/[^/]+$/, module: "admin_branches", action: "DELETE" },

  { method: "GET", pattern: /^\/api\/students$/, module: "students", action: "VIEW" },
  { method: "POST", pattern: /^\/api\/students$/, module: "students", action: "CREATE" },
  { method: "GET", pattern: /^\/api\/students\/[^/]+$/, module: "students", action: "VIEW" },
  { method: "PATCH", pattern: /^\/api\/students\/[^/]+$/, module: "students", action: "UPDATE" },
  { method: "POST", pattern: /^\/api\/students\/bulk-status$/, module: "students", action: "UPDATE" },
  { method: "GET", pattern: /^\/api\/students\/[^/]+\/finance$/, module: "students", action: "VIEW" },
  { method: "GET", pattern: /^\/api\/students\/[^/]+\/app-progress$/, module: "students", action: "VIEW" },

  { method: "GET", pattern: /^\/api\/courses$/, module: "courses", action: "VIEW" },
  { method: "POST", pattern: /^\/api\/courses$/, module: "courses", action: "CREATE" },
  { method: "GET", pattern: /^\/api\/courses\/[^/]+$/, module: "courses", action: "VIEW" },
  { method: "PATCH", pattern: /^\/api\/courses\/[^/]+$/, module: "courses", action: "UPDATE" },
  { method: "GET", pattern: /^\/api\/courses\/[^/]+\/schedule$/, module: "schedule", action: "VIEW" },
  { method: "POST", pattern: /^\/api\/courses\/[^/]+\/schedule$/, module: "schedule", action: "CREATE" },

  { method: "GET", pattern: /^\/api\/notifications$/, module: "notifications", action: "VIEW" },
  { method: "PATCH", pattern: /^\/api\/notifications\/[^/]+$/, module: "notifications", action: "UPDATE" },
  { method: "POST", pattern: /^\/api\/notifications\/generate$/, module: "notifications", action: "CREATE" },

  { method: "GET", pattern: /^\/api\/outbound\/messages$/, module: "messaging", action: "VIEW" },
  { method: "POST", pattern: /^\/api\/outbound\/messages$/, module: "messaging", action: "CREATE" },
  { method: "GET", pattern: /^\/api\/outbound\/jobs$/, module: "outbound_jobs", action: "VIEW" },
  { method: "POST", pattern: /^\/api\/outbound\/jobs$/, module: "outbound_jobs", action: "CREATE" },
  { method: "POST", pattern: /^\/api\/outbound\/dispatch$/, module: "messaging", action: "RUN" },

  { method: "GET", pattern: /^\/api\/leads$/, module: "leads", action: "VIEW" },
  { method: "POST", pattern: /^\/api\/leads$/, module: "leads", action: "CREATE" },
  { method: "GET", pattern: /^\/api\/leads\/[^/]+$/, module: "leads", action: "VIEW" },
  { method: "PATCH", pattern: /^\/api\/leads\/[^/]+$/, module: "leads", action: "UPDATE" },
  { method: "GET", pattern: /^\/api\/leads\/[^/]+\/events$/, module: "leads", action: "VIEW" },
  { method: "POST", pattern: /^\/api\/leads\/[^/]+\/events$/, module: "leads", action: "UPDATE" },
  { method: "POST", pattern: /^\/api\/leads\/assign$/, module: "leads", action: "ASSIGN" },
  { method: "POST", pattern: /^\/api\/leads\/auto-assign$/, module: "leads", action: "ASSIGN" },
  { method: "GET", pattern: /^\/api\/leads\/unassigned-count$/, module: "leads", action: "VIEW" },
  { method: "GET", pattern: /^\/api\/leads\/stale$/, module: "leads", action: "VIEW" },
  { method: "GET", pattern: /^\/api\/leads\/export$/, module: "leads", action: "VIEW" },
  { method: "POST", pattern: /^\/api\/leads\/bulk-assign$/, module: "leads", action: "ASSIGN" },

  { method: "GET", pattern: /^\/api\/receipts$/, module: "receipts", action: "VIEW" },
  { method: "POST", pattern: /^\/api\/receipts$/, module: "receipts", action: "CREATE" },
  { method: "GET", pattern: /^\/api\/receipts\/summary$/, module: "receipts", action: "VIEW" },
  { method: "GET", pattern: /^\/api\/receipts\/[^/]+$/, module: "receipts", action: "VIEW" },
  { method: "PATCH", pattern: /^\/api\/receipts\/[^/]+$/, module: "receipts", action: "UPDATE" },

  { method: "GET", pattern: /^\/api\/schedule$/, module: "schedule", action: "VIEW" },
  { method: "POST", pattern: /^\/api\/schedule$/, module: "schedule", action: "CREATE" },
  { method: "GET", pattern: /^\/api\/schedule\/[^/]+$/, module: "schedule", action: "VIEW" },
  { method: "PATCH", pattern: /^\/api\/schedule\/[^/]+$/, module: "schedule", action: "UPDATE" },
  { method: "POST", pattern: /^\/api\/schedule\/[^/]+\/attendance$/, module: "schedule", action: "UPDATE" },

  { method: "GET", pattern: /^\/api\/admin\/payroll$/, module: "hr_total_payroll", action: "VIEW" },
  { method: "POST", pattern: /^\/api\/admin\/payroll\/generate$/, module: "hr_total_payroll", action: "RUN" },
  { method: "POST", pattern: /^\/api\/admin\/payroll\/finalize$/, module: "hr_total_payroll", action: "RUN" },
  { method: "GET", pattern: /^\/api\/admin\/salary-profiles$/, module: "hr_payroll_profiles", action: "VIEW" },
  { method: "POST", pattern: /^\/api\/admin\/salary-profiles$/, module: "hr_payroll_profiles", action: "CREATE" },
  { method: "GET", pattern: /^\/api\/admin\/salary-profiles\/[^/]+$/, module: "hr_payroll_profiles", action: "VIEW" },
  { method: "PATCH", pattern: /^\/api\/admin\/salary-profiles\/[^/]+$/, module: "hr_payroll_profiles", action: "UPDATE" },
  { method: "GET", pattern: /^\/api\/admin\/attendance$/, module: "hr_attendance", action: "VIEW" },
  { method: "POST", pattern: /^\/api\/admin\/attendance$/, module: "hr_attendance", action: "CREATE" },
  { method: "PATCH", pattern: /^\/api\/admin\/attendance\/[^/]+$/, module: "hr_attendance", action: "UPDATE" },
  { method: "GET", pattern: /^\/api\/admin\/employee-kpi$/, module: "hr_kpi", action: "VIEW" },
  { method: "POST", pattern: /^\/api\/admin\/employee-kpi$/, module: "hr_kpi", action: "CREATE" },
  { method: "PATCH", pattern: /^\/api\/admin\/employee-kpi\/[^/]+$/, module: "hr_kpi", action: "UPDATE" },
  { method: "GET", pattern: /^\/api\/admin\/commissions$/, module: "hr_total_payroll", action: "VIEW" },
  { method: "POST", pattern: /^\/api\/admin\/commissions$/, module: "hr_total_payroll", action: "RUN" },
  { method: "POST", pattern: /^\/api\/admin\/commissions\/rebuild$/, module: "hr_total_payroll", action: "RUN" },
  { method: "POST", pattern: /^\/api\/admin\/commissions\/paid50\/rebuild$/, module: "hr_total_payroll", action: "RUN" },

  { method: "GET", pattern: /^\/api\/automation\/logs$/, module: "automation_logs", action: "VIEW" },
  { method: "POST", pattern: /^\/api\/automation\/logs$/, module: "automation_logs", action: "CREATE" },
  { method: "POST", pattern: /^\/api\/automation\/run$/, module: "automation_run", action: "RUN" },
  { method: "POST", pattern: /^\/api\/admin\/worker\/outbound$/, module: "admin_send_progress", action: "RUN" },
  { method: "GET", pattern: /^\/api\/admin\/scheduler\/health$/, module: "admin_plans", action: "VIEW" },
  { method: "GET", pattern: /^\/api\/scheduler\/health$/, module: "admin_plans", action: "VIEW" },
  { method: "POST", pattern: /^\/api\/admin\/cron\/daily$/, module: "admin_automation_admin", action: "RUN" },

  { method: "GET", pattern: /^\/api\/admin\/ops\/pulse$/, module: "ops_ai_hr", action: "VIEW" },
  { method: "POST", pattern: /^\/api\/admin\/ops\/pulse$/, module: "ops_ai_hr", action: "RUN" },
  { method: "GET", pattern: /^\/api\/admin\/n8n\/workflows$/, module: "ops_n8n", action: "VIEW" },
  { method: "GET", pattern: /^\/api\/admin\/n8n\/workflows\/[^/]+$/, module: "ops_n8n", action: "VIEW" },
  { method: "GET", pattern: /^\/api\/admin\/automation\/overview$/, module: "ops_n8n", action: "VIEW" },
  { method: "GET", pattern: /^\/api\/admin\/automation\/jobs$/, module: "ops_n8n", action: "VIEW" },
  { method: "GET", pattern: /^\/api\/admin\/automation\/logs$/, module: "ops_n8n", action: "VIEW" },
  { method: "GET", pattern: /^\/api\/admin\/automation\/errors$/, module: "ops_n8n", action: "VIEW" },

  { method: "GET", pattern: /^\/api\/admin\/permission-groups$/, module: "admin_users", action: "VIEW" },
  { method: "POST", pattern: /^\/api\/admin\/permission-groups$/, module: "admin_users", action: "CREATE" },
  { method: "GET", pattern: /^\/api\/admin\/permission-groups\/[^/]+$/, module: "admin_users", action: "VIEW" },
  { method: "PATCH", pattern: /^\/api\/admin\/permission-groups\/[^/]+$/, module: "admin_users", action: "UPDATE" },
  { method: "DELETE", pattern: /^\/api\/admin\/permission-groups\/[^/]+$/, module: "admin_users", action: "DELETE" },
  { method: "GET", pattern: /^\/api\/admin\/permission-groups\/[^/]+\/rules$/, module: "admin_users", action: "VIEW" },
  { method: "PUT", pattern: /^\/api\/admin\/permission-groups\/[^/]+\/rules$/, module: "admin_users", action: "UPDATE" },
  { method: "GET", pattern: /^\/api\/admin\/users\/[^/]+\/permission-overrides$/, module: "admin_users", action: "VIEW" },
  { method: "PUT", pattern: /^\/api\/admin\/users\/[^/]+\/permission-overrides$/, module: "admin_users", action: "UPDATE" },

  { method: "GET", pattern: /^\/api\/tuition-plans$/, module: "admin_tuition", action: "VIEW" },
  { method: "POST", pattern: /^\/api\/tuition-plans$/, module: "admin_tuition", action: "CREATE" },
  { method: "GET", pattern: /^\/api\/tuition-plans\/[^/]+$/, module: "admin_tuition", action: "VIEW" },
  { method: "PATCH", pattern: /^\/api\/tuition-plans\/[^/]+$/, module: "admin_tuition", action: "UPDATE" },

  { method: "GET", pattern: /^\/api\/admin\/student-content$/, module: "admin_student_content", action: "VIEW" },
  { method: "POST", pattern: /^\/api\/admin\/student-content$/, module: "admin_student_content", action: "CREATE" },
  { method: "PATCH", pattern: /^\/api\/admin\/student-content\/[^/]+$/, module: "admin_student_content", action: "UPDATE" },

  { method: "GET", pattern: /^\/api\/admin\/marketing\/reports$/, module: "marketing_meta_ads", action: "VIEW" },
  { method: "POST", pattern: /^\/api\/admin\/marketing\/report$/, module: "marketing_meta_ads", action: "CREATE" },
  { method: "POST", pattern: /^\/api\/admin\/marketing\/ingest$/, module: "marketing_meta_ads", action: "CREATE" },
  { method: "GET", pattern: /^\/api\/marketing\/metrics$/, module: "marketing_meta_ads", action: "VIEW" },

  { method: "GET", pattern: /^\/api\/expenses\/daily$/, module: "expenses", action: "VIEW" },
  { method: "POST", pattern: /^\/api\/expenses\/daily$/, module: "expenses", action: "EDIT" },
  { method: "GET", pattern: /^\/api\/expenses\/summary$/, module: "expenses", action: "VIEW" },
  { method: "GET", pattern: /^\/api\/expenses\/base-salary$/, module: "salary", action: "VIEW" },
  { method: "POST", pattern: /^\/api\/expenses\/base-salary$/, module: "salary", action: "EDIT" },
  { method: "GET", pattern: /^\/api\/insights\/expenses$/, module: "insights", action: "VIEW" },

  { method: "GET", pattern: /^\/api\/admin\/tracking-codes$/, module: "admin_tracking", action: "VIEW" },
  { method: "POST", pattern: /^\/api\/admin\/tracking-codes$/, module: "admin_tracking", action: "CREATE" },
  { method: "PATCH", pattern: /^\/api\/admin\/tracking-codes\/[^/]+$/, module: "admin_tracking", action: "UPDATE" },
  { method: "DELETE", pattern: /^\/api\/admin\/tracking-codes\/[^/]+$/, module: "admin_tracking", action: "DELETE" },
];

function matchesAllowlist(
  pathname: string,
  method: string,
  list: Array<{ method?: string; pattern: RegExp }>
) {
  const methodUpper = method.toUpperCase();
  return list.some((rule) => {
    if (rule.method && rule.method !== methodUpper) return false;
    return rule.pattern.test(pathname);
  });
}

export function isPublicApiRoute(pathname: string, method: string) {
  return matchesAllowlist(pathname, method, PUBLIC_API_ROUTES);
}

export function isSecretAuthRoute(pathname: string, method: string) {
  return matchesAllowlist(pathname, method, SECRET_AUTH_ROUTES);
}

export function isAllowlistedApiRoute(pathname: string, method: string) {
  return isPublicApiRoute(pathname, method) || isSecretAuthRoute(pathname, method);
}

export function resolveRoutePermission(pathname: string, method: string) {
  const methodUpper = method.toUpperCase();
  return ROUTE_PERMISSION_RULES.find((rule) => rule.method === methodUpper && rule.pattern.test(pathname));
}
