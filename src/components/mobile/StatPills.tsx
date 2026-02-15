"use client";

type StatPillItem = {
  label: string;
  value: string | number;
};

type StatPillsProps = {
  items: StatPillItem[];
};

export function StatPills({ items }: StatPillsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5">
          <span className="text-[11px] text-zinc-500">{item.label}: </span>
          <span className="text-xs font-semibold text-slate-900">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
