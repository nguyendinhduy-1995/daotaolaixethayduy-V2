"use client";

import { ReactNode } from "react";

type TableProps = {
  headers: string[];
  children: ReactNode;
};

export function Table({ headers, children }: TableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-700">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-4 py-3 font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 [&>tr:nth-child(even)]:bg-zinc-50/40 [&>tr:hover]:bg-slate-50/70">{children}</tbody>
        </table>
      </div>
    </div>
  );
}
