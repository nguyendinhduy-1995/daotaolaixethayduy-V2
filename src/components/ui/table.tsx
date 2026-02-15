"use client";

import { ReactNode } from "react";

type TableProps = {
  headers: string[];
  children: ReactNode;
};

export function Table({ headers, children }: TableProps) {
  return (
    <div className="overflow-hidden rounded-[16px] border border-[var(--border)] bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-50/90 text-zinc-700">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-4 py-3.5 font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 [&>tr:hover]:bg-slate-50/60">{children}</tbody>
        </table>
      </div>
    </div>
  );
}
