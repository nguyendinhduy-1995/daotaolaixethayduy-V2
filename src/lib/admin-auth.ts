import { jsonError } from "@/lib/api-response";

export const ADMIN_ROLE = "admin";

export function isAdminRole(role: string) {
  return role.toLowerCase() === ADMIN_ROLE;
}

export function requireAdminRole(role: string) {
  if (isAdminRole(role)) return null;
  return jsonError(403, "AUTH_FORBIDDEN", "Admin only");
}
