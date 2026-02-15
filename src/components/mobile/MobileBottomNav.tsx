"use client";

import Link from "next/link";
import { useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Input } from "@/components/ui/input";

type NavItem = {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

type MobileBottomNavProps = {
  pathname: string;
  mainItems: NavItem[];
  sections: NavSection[];
};

export function MobileBottomNav({ pathname, mainItems, sections }: MobileBottomNavProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const main = mainItems.slice(0, 4);

  const filteredSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase())),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-white/95 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-[420px] items-center justify-between px-2">
          {main.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-w-0 flex-1 flex-col items-center rounded-xl px-2 py-2 text-[11px] ${
                  active ? "bg-slate-900 text-white" : "text-zinc-600"
                }`}
              >
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex flex-1 flex-col items-center rounded-xl px-2 py-2 text-[11px] text-zinc-600"
          >
            <span>Thêm</span>
          </button>
        </div>
      </nav>

      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title="Điều hướng nhanh"
        footer={
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-11 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700"
            >
              Đóng
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <Input placeholder="Tìm trang..." value={query} onChange={(e) => setQuery(e.target.value)} />
          {filteredSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{section.title}</p>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`block rounded-xl border px-3 py-2 text-sm ${
                      item.match(pathname)
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-700"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
