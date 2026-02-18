"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { ADMIN_MENU, GROUP_COLORS, type AdminMenuItem } from "@/lib/admin-menu";
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
      className={`hidden h-screen shrink-0 border-r border-zinc-200/60 bg-gradient-to-b from-zinc-50/80 to-white px-3 py-3 md:block transition-all duration-300 ${collapsed ? "w-[88px]" : "w-[320px]"}`}
    >
      <div className="flex h-full flex-col">
        {/* ── Sidebar Header ── */}
        <div className="mb-3 flex items-center justify-between gap-2">
          {!collapsed ? (
            <div className="flex items-center gap-2">
              <span className="text-lg">🚗</span>
              <p className="text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Đào Tạo Lái Xe Thầy Duy</p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => setCollapsed((x) => !x)}
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-500 shadow-sm transition hover:border-zinc-300 hover:shadow-md active:scale-95"
          >
            {collapsed ? "☰" : "◁"}
          </button>
        </div>

        {/* ── Search ── */}
        {!collapsed ? (
          <div className="relative mb-3">
            <Input
              placeholder="🔍 Tìm tính năng..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="!rounded-xl !border-zinc-200 !bg-white !shadow-sm focus:!border-blue-400 focus:!ring-2 focus:!ring-blue-100 transition-all"
            />
          </div>
        ) : null}

        {/* ── Groups ── */}
        <div className="mt-1 flex-1 space-y-2 overflow-y-auto pr-1 scrollbar-thin">
          {grouped.map((group, groupIdx) => {
            const expanded = openGroups.includes(group.group);
            const colors = GROUP_COLORS[group.group] || GROUP_COLORS["Quản trị"];
            return (
              <section
                key={group.group}
                className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm animate-fadeInUp transition-all duration-300"
                style={{ animationDelay: `${groupIdx * 60}ms` }}
              >
                {/* ── Group gradient accent ── */}
                <div className={`h-0.5 bg-gradient-to-r ${colors.from} ${colors.to}`} />

                {!collapsed ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.group)}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left text-[13px] font-semibold text-zinc-700 transition hover:bg-zinc-50/80"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-sm">{colors.icon}</span>
                      <span>{group.group}</span>
                    </span>
                    <span className={`text-zinc-400 transition-transform duration-200 ${expanded ? "rotate-0" : "-rotate-90"}`}>▾</span>
                  </button>
                ) : null}

                {(collapsed || expanded) && (
                  <div className={`${collapsed ? "space-y-1 p-1.5" : "space-y-0.5 px-2 pb-2"}`}>
                    {group.items.map((item, idx) => {
                      const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => router.push(item.href)}
                          title={collapsed ? item.label : undefined}
                          className={`group/item relative flex w-full items-center rounded-xl text-left transition-all duration-200 ${collapsed ? "h-10 justify-center px-2" : "h-9 gap-2.5 px-2.5"
                            } ${active
                              ? `${colors.accent} text-white shadow-md shadow-black/10`
                              : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                            }`}
                          style={{ animationDelay: `${groupIdx * 60 + idx * 30}ms` }}
                        >
                          {/* item icon */}
                          <span className={`text-sm transition-transform duration-200 group-hover/item:scale-110 ${active ? "drop-shadow-sm" : ""}`}>
                            {item.icon || "•"}
                          </span>
                          {!collapsed && (
                            <span className="truncate text-[13px] font-medium">{item.label}</span>
                          )}
                          {/* active indicator dot */}
                          {active && !collapsed && (
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-white/80 animate-pulse" />
                          )}
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
