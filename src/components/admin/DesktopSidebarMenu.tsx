"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { ADMIN_MENU, type AdminMenuItem } from "@/lib/admin-menu";
import { hasUiPermission, moduleKeyFromHref } from "@/lib/ui-permissions";

type DesktopSidebarMenuProps = {
  permissions: string[] | undefined;
  isAdmin: boolean;
  items?: AdminMenuItem[];
};

function normalizeVi(input: string) {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

const DEFAULT_GROUPS = ["Tổng quan", "Khách & Tư vấn", "Học viên & Lịch", "Tài chính", "Tự động hoá", "Quản trị"] as const;

export function DesktopSidebarMenu({ permissions, isAdmin, items = ADMIN_MENU }: DesktopSidebarMenuProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<string[]>([...DEFAULT_GROUPS]);

  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      const moduleKey = moduleKeyFromHref(item.href);
      if (!moduleKey) return isAdmin;
      return hasUiPermission(permissions, moduleKey, "VIEW");
    });
  }, [isAdmin, items, permissions]);

  const normalizedQuery = normalizeVi(query);
  const filtered = useMemo(() => {
    if (!normalizedQuery) return visibleItems;
    return visibleItems.filter((item) => {
      const haystack = [item.label, item.href, ...(item.keywords || [])].map(normalizeVi).join(" ");
      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery, visibleItems]);

  const grouped = useMemo(() => {
    const map = new Map<string, AdminMenuItem[]>();
    for (const item of filtered) {
      const rows = map.get(item.group) || [];
      rows.push(item);
      map.set(item.group, rows);
    }
    return DEFAULT_GROUPS.map((group) => ({ group, items: map.get(group) || [] })).filter((g) => g.items.length > 0);
  }, [filtered]);

  function toggleGroup(group: string) {
    setOpenGroups((prev) => (prev.includes(group) ? prev.filter((x) => x !== group) : [...prev, group]));
  }

  return (
    <aside
      className={`hidden h-screen shrink-0 border-r border-zinc-200 bg-white/90 px-3 py-3 md:block ${collapsed ? "w-[88px]" : "w-[320px]"}`}
    >
      <div className="flex h-full flex-col">
        <div className="mb-3 flex items-center justify-between gap-2">
          {!collapsed ? <p className="text-sm font-semibold text-zinc-900">Menu quản trị</p> : null}
          <button
            type="button"
            onClick={() => setCollapsed((x) => !x)}
            className="rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-600"
          >
            {collapsed ? "Mở" : "Thu gọn"}
          </button>
        </div>

        {!collapsed ? <Input placeholder="Tìm tính năng..." value={query} onChange={(e) => setQuery(e.target.value)} /> : null}

        <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
          {grouped.map((group) => {
            const expanded = openGroups.includes(group.group);
            return (
              <section key={group.group} className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-2">
                {!collapsed ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.group)}
                    className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-left text-sm font-semibold text-zinc-800"
                  >
                    <span>{group.group}</span>
                    <span className="text-zinc-500">{expanded ? "−" : "+"}</span>
                  </button>
                ) : null}

                {(collapsed || expanded) && (
                  <div className={`${collapsed ? "space-y-2" : "mt-1 space-y-1"}`}>
                    {group.items.map((item) => {
                      const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => router.push(item.href)}
                          title={collapsed ? item.label : undefined}
                          className={`flex w-full items-center rounded-xl border text-left transition ${
                            collapsed ? "h-10 justify-center px-2" : "h-10 px-3"
                          } ${
                            active
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300"
                          }`}
                        >
                          {collapsed ? <span className="text-xs font-semibold">{item.label.slice(0, 2)}</span> : <span className="truncate text-sm">{item.label}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

