import type { Role } from "@prisma/client";

export type KpiMetricUnit = "%";

export type KpiMetricDef = {
  key: string;
  labelVi: string;
  descVi: string;
  unit: KpiMetricUnit;
  roleAllowed: Array<"direct_page" | "telesales">;
};

export const KPI_METRICS_CATALOG: KpiMetricDef[] = [
  {
    key: "has_phone_rate_pct",
    labelVi: "Tỉ lệ lấy được số",
    descVi: "Tỉ lệ lấy được số điện thoại từ data tin nhắn chưa có số của Trực Page.",
    unit: "%",
    roleAllowed: ["direct_page"],
  },
  {
    key: "appointed_rate_pct",
    labelVi: "Tỉ lệ hẹn từ data",
    descVi: "Tỉ lệ khách hẹn trên tổng data có số của Tư vấn.",
    unit: "%",
    roleAllowed: ["telesales"],
  },
  {
    key: "arrived_rate_pct",
    labelVi: "Tỉ lệ đến từ hẹn",
    descVi: "Tỉ lệ khách đến trên tổng khách đã hẹn của Tư vấn.",
    unit: "%",
    roleAllowed: ["telesales"],
  },
  {
    key: "signed_rate_pct",
    labelVi: "Tỉ lệ ký từ đến",
    descVi: "Tỉ lệ khách ký trên tổng khách đã đến của Tư vấn.",
    unit: "%",
    roleAllowed: ["telesales"],
  },
];

const METRIC_MAP = new Map(KPI_METRICS_CATALOG.map((item) => [item.key, item]));

export function getMetricDef(key: string) {
  return METRIC_MAP.get(key) || null;
}

export function getMetricLabelVi(key: string) {
  return getMetricDef(key)?.labelVi || key;
}

export function isMetricAllowedForRole(key: string, role: Role | string) {
  const roleValue = String(role) as "direct_page" | "telesales";
  const def = getMetricDef(key);
  if (!def) return false;
  return def.roleAllowed.includes(roleValue);
}

export function metricsForRole(role: Role | string) {
  const roleValue = String(role) as "direct_page" | "telesales";
  return KPI_METRICS_CATALOG.filter((item) => item.roleAllowed.includes(roleValue));
}

export function roleLabelVi(role: Role | string) {
  if (role === "direct_page") return "Trực Page";
  if (role === "telesales") return "Tư vấn";
  if (role === "manager") return "Quản lý";
  if (role === "admin") return "Quản trị";
  return String(role);
}

export function dayOfWeekLabelVi(dayOfWeek: number | null) {
  if (dayOfWeek === null || dayOfWeek < 0) return "Mọi ngày";
  const map: Record<number, string> = {
    1: "Thứ 2",
    2: "Thứ 3",
    3: "Thứ 4",
    4: "Thứ 5",
    5: "Thứ 6",
    6: "Thứ 7",
    0: "Chủ nhật",
  };
  return map[dayOfWeek] || "Mọi ngày";
}
