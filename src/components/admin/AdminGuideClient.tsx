"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchMe, type MeResponse } from "@/lib/auth-client";
import { hasUiPermission } from "@/lib/ui-permissions";
import type { ModuleKey } from "@/lib/permission-keys";

type GuideSection = {
  id: string;
  title: string;
  content: string;
  moduleKey: ModuleKey | null;
};

const TITLE_TO_MODULE: Array<{ includes: string; module: ModuleKey }> = [
  { includes: "tổng quan", module: "overview" },
  { includes: "khách hàng", module: "leads" },
  { includes: "kpi", module: "kpi_daily" },
  { includes: "mục tiêu kpi", module: "kpi_targets" },
  { includes: "mục tiêu ngày", module: "goals" },
  { includes: "trợ lý công việc", module: "ai_kpi_coach" },
  { includes: "thu tiền", module: "receipts" },
  { includes: "lương", module: "hr_total_payroll" },
  { includes: "học viên", module: "students" },
  { includes: "khóa học", module: "courses" },
  { includes: "lịch học", module: "schedule" },
  { includes: "tự động hóa", module: "automation_run" },
  { includes: "outbound", module: "messaging" },
  { includes: "chi phí", module: "expenses" },
  { includes: "api hub", module: "api_hub" },
  { includes: "người dùng", module: "admin_users" },
  { includes: "chi nhánh", module: "admin_branches" },
  { includes: "học phí", module: "admin_tuition" },
];

function toSectionId(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sectionModule(title: string): ModuleKey | null {
  const lower = title.toLowerCase();
  const found = TITLE_TO_MODULE.find((item) => lower.includes(item.includes));
  return found?.module ?? null;
}

function parseSections(markdown: string): GuideSection[] {
  const parts = markdown.split(/^##\s+/gm).filter(Boolean);
  return parts.map((part, index) => {
    const lines = part.split("\n");
    const title = (lines.shift() || `Mục ${index + 1}`).trim();
    const content = lines.join("\n").trim();
    return {
      id: toSectionId(title) || `muc-${index + 1}`,
      title,
      content,
      moduleKey: sectionModule(title),
    };
  });
}

export function AdminGuideClient({ markdown }: { markdown: string }) {
  const [query, setQuery] = useState("");
  const [user, setUser] = useState<MeResponse["user"] | null>(null);
  const guardRef = useRef(false);

  useEffect(() => {
    if (guardRef.current) return;
    guardRef.current = true;
    fetchMe()
      .then((res) => setUser(res.user))
      .catch(() => setUser(null));
  }, []);

  const sections = useMemo(() => parseSections(markdown), [markdown]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter((item) => item.title.toLowerCase().includes(q) || item.content.toLowerCase().includes(q));
  }, [sections, query]);

  return (
    <div className="mx-auto w-full max-w-screen-sm space-y-4 pb-24 md:max-w-4xl md:pb-6">
      <section className="rounded-2xl border border-zinc-200 bg-white/90 p-4 shadow-sm backdrop-blur md:p-5">
        <h1 className="text-lg font-semibold text-zinc-900 md:text-xl">Hướng dẫn vận hành Admin</h1>
        <p className="mt-1 text-sm text-zinc-600">Tài liệu tổng hợp nghiệp vụ, RBAC, API và checklist theo vai trò.</p>
        <div className="mt-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm trong hướng dẫn..."
            className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white/90 p-4 shadow-sm backdrop-blur md:p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Mục lục</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {filtered.map((item) => (
            <a key={item.id} href={`#${item.id}`} className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-700">
              {item.title}
            </a>
          ))}
        </div>
      </section>

      {filtered.map((section) => {
        const hasPermission = section.moduleKey
          ? hasUiPermission(user?.permissions, section.moduleKey, "VIEW")
          : true;

        return (
          <details
            key={section.id}
            id={section.id}
            className="group rounded-2xl border border-zinc-200 bg-white/95 shadow-sm transition open:border-zinc-300"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 active:scale-[0.99] md:px-5">
              <div>
                <p className="text-sm font-semibold text-zinc-900 md:text-base">{section.title}</p>
                <p className="text-xs text-zinc-500">{section.moduleKey ? `Module: ${section.moduleKey}` : "Tài liệu chung"}</p>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                  hasPermission ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                }`}
              >
                {hasPermission ? "Có quyền truy cập" : "Không có quyền truy cập"}
              </span>
            </summary>
            <div className="border-t border-zinc-100 px-4 py-3 md:px-5">
              <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-zinc-700">{section.content}</pre>
            </div>
          </details>
        );
      })}
    </div>
  );
}
