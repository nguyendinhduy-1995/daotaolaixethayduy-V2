"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ChecklistItem = {
  id: string;
  label: string;
  hint?: string;
  actionHref?: string;
  actionLabel?: string;
};

type SuggestedChecklistProps = {
  storageKey: string;
  title?: string;
  items: ChecklistItem[];
};

export function SuggestedChecklist({ storageKey, title = "Gợi ý hôm nay", items }: SuggestedChecklistProps) {
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(checked));
  }, [checked, storageKey]);

  const completed = useMemo(() => items.filter((item) => checked[item.id]).length, [items, checked]);

  return (
    <section className="ios-glass rounded-2xl border border-zinc-200/70 p-3 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:hidden">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <span className="text-xs text-zinc-500">
          {completed}/{items.length}
        </span>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-zinc-200/70 bg-white/70 px-3 py-2">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={Boolean(checked[item.id])}
                onChange={(e) => setChecked((prev) => ({ ...prev, [item.id]: e.target.checked }))}
                className="mt-0.5 accent-amber-600"
              />
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${checked[item.id] ? "text-zinc-500 line-through" : "text-zinc-800"}`}>{item.label}</p>
                {item.hint ? <p className="text-xs text-zinc-500">{item.hint}</p> : null}
              </div>
              {item.actionHref ? (
                <Link href={item.actionHref} className="tap-feedback rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700">
                  {item.actionLabel || "Mở"}
                </Link>
              ) : null}
            </label>
          </div>
        ))}
      </div>
    </section>
  );
}
