import { jsonError } from "@/lib/api-response";

export const ADMIN_ROLE = "admin";
export const TELESALES_ROLE = "telesales";

export function isAdminRole(role: string) {
  return role.toLowerCase() === ADMIN_ROLE;
}

export function requireAdminRole(role: string) {
  if (isAdminRole(role)) return null;
  return jsonError(403, "AUTH_FORBIDDEN", "Admin only");
}

export function isTelesalesRole(role: string) {
  return role.toLowerCase() === TELESALES_ROLE;
}

export function canAccessLeads(role: string) {
  return isAdminRole(role) || isTelesalesRole(role);
}

export function requireLeadRole(role: string) {
  if (canAccessLeads(role)) return null;
  return jsonError(403, "AUTH_FORBIDDEN", "Forbidden");
}
