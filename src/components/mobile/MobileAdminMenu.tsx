"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Input } from "@/components/ui/input";
import { ADMIN_MENU, type AdminMenuItem } from "@/lib/admin-menu";
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
  { key: "create-customer", label: "Tạo khách hàng", href: "/leads" },
  { key: "create-receipt", label: "Tạo phiếu thu", href: "/receipts" },
  { key: "create-student", label: "Tạo học viên", href: "/students" },
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

    return grouped.map(([group, menuItems]) => {
      const expanded = openGroups.includes(group);
      return (
        <div key={group} className="space-y-1.5 rounded-2xl border border-zinc-200 bg-white p-2">
          <button
            type="button"
            onClick={() => toggleGroup(group)}
            className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-sm font-semibold text-zinc-800"
          >
            <span>{group}</span>
            <span className="text-zinc-400">{expanded ? "−" : "+"}</span>
          </button>
          {expanded ? (
            <div className="space-y-1">
              {menuItems.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      router.push(item.href);
                      setMenuOpen(false);
                    }}
                    className={`tap-feedback active:scale-[0.98] flex h-[48px] w-full items-center rounded-xl border px-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
                      active ? "border-slate-900 bg-slate-900 text-white" : "border-zinc-200 bg-white text-zinc-800"
                    }`}
                  >
                    <span className="truncate">{item.label}</span>
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
      <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(env(safe-area-inset-bottom),10px)] md:hidden">
        <div className="mx-auto flex w-full max-w-screen-sm items-center gap-2 rounded-2xl border border-zinc-200/80 bg-white/80 p-2 shadow-lg backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="tap-feedback active:scale-[0.98] flex h-12 flex-1 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            Menu
          </button>
          {enableQuickAdd && quickActions.length > 0 ? (
            <button
              type="button"
              onClick={() => setQuickAddOpen(true)}
              className="tap-feedback active:scale-[0.98] h-12 rounded-xl border border-zinc-200 bg-white/90 px-4 text-sm font-semibold text-zinc-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              + Thêm
            </button>
          ) : null}
        </div>
      </div>

      <BottomSheet open={menuOpen} onOpenChange={setMenuOpen} title="Menu quản trị">
        <div className="space-y-3">
          <Input placeholder="Tìm tính năng..." value={query} onChange={(e) => setQuery(e.target.value)} />
          {renderGroupList()}
        </div>
      </BottomSheet>

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
              className="tap-feedback active:scale-[0.98] flex h-[50px] w-full items-center rounded-xl border border-zinc-200 bg-white px-3 text-left text-sm font-medium text-zinc-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              {action.label}
            </button>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
