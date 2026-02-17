import type { ActionKey, ModuleKey } from "@/lib/permission-keys";
import { ACTION_KEYS, MODULE_KEYS } from "@/lib/permission-keys";

export type PermissionEntryInput = {
  module: ModuleKey;
  action: ActionKey;
  allowed: boolean;
};

export function isModuleKey(value: unknown): value is ModuleKey {
  return typeof value === "string" && MODULE_KEYS.includes(value as ModuleKey);
}

export function isActionKey(value: unknown): value is ActionKey {
  return typeof value === "string" && ACTION_KEYS.includes(value as ActionKey);
}

export function parsePermissionEntries(value: unknown): PermissionEntryInput[] {
  if (!Array.isArray(value)) throw new Error("INVALID_RULES");

  const normalized = new Map<string, PermissionEntryInput>();
  for (const row of value) {
    if (!row || typeof row !== "object") throw new Error("INVALID_RULES");
    const item = row as Record<string, unknown>;
    if (!isModuleKey(item.module) || !isActionKey(item.action) || typeof item.allowed !== "boolean") {
      throw new Error("INVALID_RULES");
    }
    const key = `${item.module}:${item.action}`;
    normalized.set(key, {
      module: item.module,
      action: item.action,
      allowed: item.allowed,
    });
  }

  return [...normalized.values()];
}
