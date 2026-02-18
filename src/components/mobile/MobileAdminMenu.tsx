"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Input } from "@/components/ui/input";
import { ADMIN_MENU, GROUP_COLORS, type AdminMenuItem } from "@/lib/admin-menu";
import { fetchMe } from "@/lib/auth-client";
import { isAdminRole } from "@/lib/admin-auth";
import { hasUiPermission, moduleKeyFromHref } from "@/lib/ui-permissions";
import { useEffect } from "react";

type MobileAdminMenuProps = {
  items?: AdminMenuItem[];
  enableQuickAdd?: boolean;
};

function normalizeVi(input: string) {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

const QUICK_ADD_ACTIONS = [
  { key: "create-customer", label: "Tạo khách hàng", href: "/leads", icon: "👤" },
  { key: "create-receipt", label: "Tạo phiếu thu", href: "/receipts", icon: "🧾" },
  { key: "create-student", label: "Tạo học viên", href: "/students", icon: "🎓" },
];

export function MobileAdminMenu({ items = ADMIN_MENU, enableQuickAdd = true }: MobileAdminMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [openGroups, setOpenGroups] = useState<string[]>([
    "Tổng quan",
    "Khách & Tư vấn",
    "Học viên & Lịch",
    "Tài chính",
    "Tự động hoá",
    "Quản trị",
  ]);

  useEffect(() => {
    fetchMe()
      .then((me) => {
        setPermissions(me.user.permissions || []);
        setIsAdmin(isAdminRole(me.user.role));
      })
      .catch(() => {
        setPermissions([]);
        setIsAdmin(false);
      });
  }, []);

  const normalizedQuery = normalizeVi(query);

  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      const moduleKey = moduleKeyFromHref(item.href);
      if (!moduleKey) return isAdmin;
      return hasUiPermission(permissions, moduleKey, "VIEW");
    });
  }, [isAdmin, items, permissions]);

  const filtered = useMemo(() => {
    if (!normalizedQuery) return visibleItems;
    return visibleItems.filter((item) => {
      const label = normalizeVi(item.label);
      const href = normalizeVi(item.href);
      const keywords = (item.keywords || []).map(normalizeVi);
      return label.includes(normalizedQuery) || href.includes(normalizedQuery) || keywords.some((k) => k.includes(normalizedQuery));
    });
  }, [normalizedQuery, visibleItems]);

  const grouped = useMemo(() => {
    const map = new Map<string, AdminMenuItem[]>();
    filtered.forEach((item) => {
      const list = map.get(item.group) || [];
      list.push(item);
      map.set(item.group, list);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const quickActions = useMemo(
    () => QUICK_ADD_ACTIONS.filter((action) => items.some((item) => item.href === action.href)),
    [items]
  );

  function toggleGroup(group: string) {
    setOpenGroups((prev) => (prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]));
  }

  function renderGroupList() {
    if (grouped.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-3 py-5 text-center text-sm text-zinc-600">
          Không có kết quả phù hợp.
        </div>
      );
    }

    return grouped.map(([group, menuItems], groupIdx) => {
      const expanded = openGroups.includes(group);
      const colors = GROUP_COLORS[group] || GROUP_COLORS["Quản trị"];
      return (
        <div
          key={group}
          className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm animate-fadeInUp"
          style={{ animationDelay: `${groupIdx * 50}ms` }}
        >
          {/* ── Group gradient accent ── */}
          <div className={`h-0.5 bg-gradient-to-r ${colors.from} ${colors.to}`} />
          <button
            type="button"
            onClick={() => toggleGroup(group)}
            className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-semibold text-zinc-700 transition active:bg-zinc-50"
          >
            <span className="flex items-center gap-2">
              <span>{colors.icon}</span>
              <span>{group}</span>
            </span>
            <span className={`text-zinc-400 transition-transform duration-200 ${expanded ? "rotate-0" : "-rotate-90"}`}>▾</span>
          </button>
          {expanded ? (
            <div className="space-y-0.5 px-2 pb-2">
              {menuItems.map((item, idx) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      router.push(item.href);
                      setMenuOpen(false);
                    }}
                    className={`tap-feedback active:scale-[0.98] group/item relative flex h-[44px] w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${active
                      ? `${colors.accent} text-white shadow-md shadow-black/10`
                      : "text-zinc-600 hover:bg-zinc-50 active:bg-zinc-100"
                      }`}
                    style={{ animationDelay: `${groupIdx * 50 + idx * 25}ms` }}
                  >
                    <span className={`text-sm transition-transform duration-200 group-hover/item:scale-110 ${active ? "drop-shadow-sm" : ""}`}>
                      {item.icon || "•"}
                    </span>
                    <span className="truncate font-medium">{item.label}</span>
                    {active && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-white/80 animate-pulse" />
                    )}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      );
    });
  }

  return (
    <>
      {/* ── Bottom Dock Bar ── */}
      <nav aria-label="Thanh điều hướng chính" className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(env(safe-area-inset-bottom),10px)] md:hidden">
        <div className="mx-auto flex w-full max-w-screen-sm items-center gap-2 rounded-2xl border border-zinc-200/60 bg-white/90 p-2 shadow-lg shadow-black/5 backdrop-blur-xl">
          <button
            type="button"
            aria-label="Mở menu quản trị"
            onClick={() => setMenuOpen(true)}
            className="tap-feedback active:scale-[0.97] flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 text-sm font-semibold text-white shadow-md shadow-blue-200 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
          >
            <span>☰</span>
            <span>Menu</span>
          </button>
          {enableQuickAdd && quickActions.length > 0 ? (
            <button
              type="button"
              aria-label="Thêm nhanh"
              onClick={() => setQuickAddOpen(true)}
              className="tap-feedback active:scale-[0.97] h-12 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
            >
              ＋ Thêm
            </button>
          ) : null}
        </div>
      </nav>

      {/* ── Menu Bottom Sheet ── */}
      <BottomSheet open={menuOpen} onOpenChange={setMenuOpen} title="Menu quản trị">
        <div className="space-y-3">
          <div className="relative">
            <Input
              placeholder="🔍 Tìm tính năng..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="!rounded-xl !border-zinc-200 !bg-zinc-50 focus:!border-blue-400 focus:!ring-2 focus:!ring-blue-100 transition-all"
            />
          </div>
          {renderGroupList()}
        </div>
      </BottomSheet>

      {/* ── Quick Add Bottom Sheet ── */}
      <BottomSheet open={quickAddOpen} onOpenChange={setQuickAddOpen} title="Thêm nhanh">
        <div className="space-y-2">
          {quickActions.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={() => {
                router.push(action.href);
                setQuickAddOpen(false);
              }}
              className="tap-feedback active:scale-[0.98] flex h-[50px] w-full items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3 text-left text-sm font-medium text-zinc-800 shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
            >
              <span className="text-lg">{action.icon}</span>
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
