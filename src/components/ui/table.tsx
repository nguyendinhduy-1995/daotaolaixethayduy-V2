"use client";

import { ReactNode } from "react";

type TableProps = {
  headers: string[];
  children: ReactNode;
};

export function Table({ headers, children }: TableProps) {
  return (
    <div className="table-mobile-cards overflow-hidden rounded-[16px] border border-zinc-200/80 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-gradient-to-r from-slate-50 to-zinc-50">
              {headers.map((header) => (
                <th key={header} className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50 [&>tr]:table-row-hover">{children}</tbody>
        </table>
      </div>
    </div>
  );
}
