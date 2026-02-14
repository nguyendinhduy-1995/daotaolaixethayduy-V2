"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { formatDateVi } from "@/lib/date-utils";

type ContentItem = {
  id: string;
  category: "HUONG_DAN" | "MEO_HOC" | "HO_SO" | "THI";
  title: string;
  body: string;
  createdAt: string;
};

export default function StudentContentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("");
  const [items, setItems] = useState<ContentItem[]>([]);

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

  function categoryLabel(value: ContentItem["category"]) {
    if (value === "HUONG_DAN") return "Hướng dẫn";
    if (value === "MEO_HOC") return "Mẹo học";
    if (value === "HO_SO") return "Hồ sơ";
    return "Thi";
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-zinc-900">Nội dung học tập</h1>
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Tất cả</option>
          <option value="HUONG_DAN">Hướng dẫn</option>
          <option value="MEO_HOC">Mẹo học</option>
          <option value="HO_SO">Hồ sơ</option>
          <option value="THI">Thi</option>
        </Select>
      </div>
      {error ? <Alert type="error" message={error} /> : null}
      {loading ? (
        <div className="flex items-center gap-2 text-zinc-700">
          <Spinner /> Đang tải...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl bg-white p-6 text-sm text-zinc-600 shadow-sm">Không có dữ liệu.</div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <article key={item.id} className="rounded-xl bg-white p-4 shadow-sm">
              <p className="text-xs text-zinc-500">{categoryLabel(item.category)} • {formatDateVi(item.createdAt)}</p>
              <h2 className="mt-1 font-medium text-zinc-900">{item.title}</h2>
              <p className="mt-2 text-sm whitespace-pre-wrap text-zinc-700">{item.body}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
