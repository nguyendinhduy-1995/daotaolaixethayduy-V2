"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateVi } from "@/lib/date-utils";

type ContentItem = {
  id: string;
  category: "HUONG_DAN" | "MEO_HOC" | "HO_SO" | "THI";
  title: string;
  body: string;
  createdAt: string;
};

/* ── Helpers ── */
function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/60 ${className}`} />;
}

const CATEGORIES = [
  { key: "", label: "Tất cả", icon: "📋" },
  { key: "HUONG_DAN", label: "Hướng dẫn", icon: "📖" },
  { key: "MEO_HOC", label: "Mẹo học", icon: "💡" },
  { key: "HO_SO", label: "Hồ sơ", icon: "📁" },
  { key: "THI", label: "Thi", icon: "🎓" },
];

function categoryLabel(value: string) {
  return CATEGORIES.find(c => c.key === value)?.label ?? value;
}

function categoryIcon(value: string) {
  return CATEGORIES.find(c => c.key === value)?.icon ?? "📄";
}

function categoryColor(value: string) {
  const s = value.toUpperCase();
  if (s === "HUONG_DAN") return "bg-blue-100 text-blue-700 border-blue-200";
  if (s === "MEO_HOC") return "bg-amber-100 text-amber-700 border-amber-200";
  if (s === "HO_SO") return "bg-slate-100 text-slate-600 border-slate-200";
  if (s === "THI") return "bg-purple-100 text-purple-700 border-purple-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

/* ── Page ── */
export default function StudentContentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("");
  const [items, setItems] = useState<ContentItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const query = category ? `?category=${category}` : "";
      const res = await fetch(`/api/student/content${query}`, { credentials: "include" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 401) router.replace("/student/login");
        else setError(body?.error?.message || "Không tải được nội dung");
        setLoading(false);
        return;
      }
      setItems(body.items || []);
      setLoading(false);
    })();
  }, [category, router]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">📚 Tài liệu học tập</h1>
        <p className="mt-0.5 text-xs text-slate-500">Hướng dẫn, mẹo học & thông báo thi</p>
      </div>

      {/* Category chip filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORIES.map((cat) => {
          const isActive = cat.key === category;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => setCategory(cat.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition-all active:scale-[0.97] ${isActive
                  ? "border-amber-400 bg-amber-500 text-white shadow-sm shadow-amber-500/20"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
            >
              <span>{cat.icon}</span>
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="space-y-3">
          <SkeletonBlock className="h-28" />
          <SkeletonBlock className="h-28" />
          <SkeletonBlock className="h-28" />
        </div>
      ) : items.length === 0 ? (
        /* Empty */
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300/80 bg-white px-5 py-14 text-center shadow-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-3xl">📭</div>
          <p className="mt-4 text-base font-bold text-slate-900">Chưa có tài liệu</p>
          <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-slate-500">
            {category ? `Không có tài liệu "${categoryLabel(category)}" nào.` : "Tài liệu sẽ được cập nhật sớm."}
          </p>
          {category && (
            <button
              type="button"
              onClick={() => setCategory("")}
              className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Xem tất cả
            </button>
          )}
        </div>
      ) : (
        /* Content cards */
        <div className="space-y-3">
          {items.map((item, idx) => {
            const isExpanded = expandedId === item.id;
            const hasLongBody = item.body.length > 120;

            return (
              <article
                key={item.id}
                className="group overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className="p-4 md:p-5">
                  {/* Meta */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${categoryColor(item.category)}`}>
                      {categoryIcon(item.category)} {categoryLabel(item.category)}
                    </span>
                    <span className="text-[11px] text-slate-400">{formatDateVi(item.createdAt)}</span>
                  </div>

                  {/* Title */}
                  <h2 className="mt-2.5 text-sm font-bold text-slate-900 md:text-base">{item.title}</h2>

                  {/* Body */}
                  <div className="relative mt-2">
                    <p className={`text-sm leading-relaxed text-slate-600 whitespace-pre-wrap ${!isExpanded && hasLongBody ? "line-clamp-3" : ""}`}>
                      {item.body}
                    </p>
                    {!isExpanded && hasLongBody && (
                      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent" />
                    )}
                  </div>

                  {/* Expand/Collapse */}
                  {hasLongBody && (
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-600 transition hover:text-amber-500"
                    >
                      {isExpanded ? (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                            <path fillRule="evenodd" d="M9.47 6.47a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 1 1-1.06 1.06L10 8.06l-3.72 3.72a.75.75 0 0 1-1.06-1.06l4.25-4.25Z" clipRule="evenodd" />
                          </svg>
                          Thu gọn
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                            <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                          </svg>
                          Xem thêm
                        </>
                      )}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
