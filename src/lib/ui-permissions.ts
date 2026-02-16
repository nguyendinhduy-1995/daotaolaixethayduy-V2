import type { ModuleKey } from "@/lib/permission-keys";

export function hasUiPermission(
  permissions: string[] | undefined,
  module: ModuleKey,
  action: "VIEW" | "CREATE" | "UPDATE" | "EDIT" | "DELETE" | "EXPORT" | "ASSIGN" | "RUN" | "INGEST"
) {
  if (!permissions || permissions.length === 0) return false;
  return permissions.includes(`${module}:${action}`);
}

const UI_ROUTE_MODULE: Array<{ match: (path: string) => boolean; module: ModuleKey }> = [
  { match: (path) => path.startsWith("/dashboard"), module: "overview" },
  { match: (path) => path === "/leads" || path.startsWith("/leads/"), module: "leads" },
  { match: (path) => path.startsWith("/leads/board"), module: "leads_board" },
  { match: (path) => path.startsWith("/kpi/daily"), module: "kpi_daily" },
  { match: (path) => path.startsWith("/kpi/targets"), module: "kpi_targets" },
  { match: (path) => path.startsWith("/goals"), module: "goals" },
  { match: (path) => path.startsWith("/ai/kpi-coach"), module: "ai_kpi_coach" },
  { match: (path) => path.startsWith("/students"), module: "students" },
  { match: (path) => path.startsWith("/courses"), module: "courses" },
  { match: (path) => path.startsWith("/schedule"), module: "schedule" },
  { match: (path) => path.startsWith("/receipts"), module: "receipts" },
  { match: (path) => path.startsWith("/notifications"), module: "notifications" },
  { match: (path) => path.startsWith("/outbound"), module: "messaging" },
  { match: (path) => path.startsWith("/me/payroll"), module: "my_payroll" },
  { match: (path) => path.startsWith("/admin/ops"), module: "ops_ai_hr" },
  { match: (path) => path.startsWith("/admin/n8n"), module: "ops_n8n" },
  { match: (path) => path.startsWith("/automation/logs"), module: "automation_logs" },
  { match: (path) => path.startsWith("/automation/run"), module: "automation_run" },
  { match: (path) => path.startsWith("/marketing"), module: "marketing_meta_ads" },
  { match: (path) => path.startsWith("/admin/branches"), module: "admin_branches" },
  { match: (path) => path.startsWith("/admin/guide"), module: "overview" },
  { match: (path) => path.startsWith("/admin/huong-dan-ai"), module: "ai_kpi_coach" },
  { match: (path) => path.startsWith("/admin/huong-dan-van-hanh"), module: "overview" },
  { match: (path) => path.startsWith("/admin/users"), module: "admin_users" },
  { match: (path) => path.startsWith("/admin/phan-quyen"), module: "admin_users" },
  { match: (path) => path.startsWith("/admin/assign-leads"), module: "admin_segments" },
  { match: (path) => path.startsWith("/admin/tuition-plans"), module: "admin_tuition" },
  { match: (path) => path.startsWith("/admin/notifications"), module: "admin_notification_admin" },
  { match: (path) => path.startsWith("/admin/cron"), module: "admin_automation_admin" },
  { match: (path) => path.startsWith("/admin/worker"), module: "admin_send_progress" },
  { match: (path) => path.startsWith("/admin/scheduler"), module: "admin_plans" },
  { match: (path) => path.startsWith("/admin/student-content"), module: "admin_student_content" },
  { match: (path) => path.startsWith("/hr/kpi"), module: "hr_kpi" },
  { match: (path) => path.startsWith("/hr/salary-profiles"), module: "hr_payroll_profiles" },
  { match: (path) => path.startsWith("/hr/attendance"), module: "hr_attendance" },
  { match: (path) => path.startsWith("/hr/payroll"), module: "hr_total_payroll" },
  { match: (path) => path.startsWith("/api-hub"), module: "api_hub" },
  { match: (path) => path.startsWith("/expenses"), module: "expenses" },
];

export function moduleKeyFromHref(href: string): ModuleKey | null {
  const matched = UI_ROUTE_MODULE.find((row) => row.match(href));
  return matched?.module ?? null;
}
