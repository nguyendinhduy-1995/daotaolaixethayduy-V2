"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, getToken } from "@/lib/auth-client";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Table } from "@/components/ui/table";

type InstructorItem = {
    id: string;
    name: string;
    phone: string | null;
    status: string;
    studentCount: number;
    lessonCount: number;
    createdAt: string;
};

type InstructorsRes = { items: InstructorItem[]; page: number; pageSize: number; total: number };

function statusBadge(status: string) {
    return status === "ACTIVE" ? <Badge text="Hoạt động" tone="success" /> : <Badge text="Ngừng" tone="neutral" />;
}

export default function InstructorsPage() {
    const router = useRouter();
    const [data, setData] = useState<InstructorsRes | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [qInput, setQInput] = useState("");
    const [q, setQ] = useState("");
    const [page, setPage] = useState(1);
    const pageSize = 20;

    /* debounce search input */
    useEffect(() => {
        const timer = setTimeout(() => {
            setQ(qInput);
            setPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [qInput]);

    const load = useCallback(async () => {
        const token = getToken();
        if (!token) { router.replace("/login"); return; }
        setLoading(true);
        setError("");
        try {
            const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
            if (q.trim()) params.set("q", q.trim());
            const res = await fetchJson<InstructorsRes>(`/api/instructors?${params}`, { token });
            setData(res);
        } catch (e) {
            const err = e as ApiClientError;
            if (err.code === "AUTH_MISSING_BEARER" || err.code === "AUTH_INVALID_TOKEN") { clearToken(); router.replace("/login"); return; }
            setError(err.message || "Lỗi tải dữ liệu");
        } finally {
            setLoading(false);
        }
    }, [page, q, router]);

    useEffect(() => { load(); }, [load]);

    return (
        <div className="space-y-4">
            {/* ── Premium Header ── */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 p-4 text-white shadow-lg shadow-cyan-200 animate-fadeInUp">
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
                <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/10 blur-xl" />
                <div className="relative flex flex-wrap items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-2xl backdrop-blur-sm">🚗</div>
                    <div className="flex-1">
                        <h2 className="text-lg font-bold">Giáo viên thực hành</h2>
                        <p className="text-sm text-white/80">{data?.total ?? 0} giáo viên</p>
                    </div>
                    <Link href="/admin/instructors/new">
                        <Button className="!bg-white !text-cyan-700 hover:!bg-white/90">+ Thêm giáo viên</Button>
                    </Link>
                </div>
            </div>

            {error ? <Alert type="error" message={error} /> : null}

            <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm animate-fadeInUp" style={{ animationDelay: "80ms" }}>
                <div className="h-1 bg-gradient-to-r from-cyan-500 to-teal-500" />
                <div className="p-4">
                    <div className="flex flex-wrap items-end gap-3">
                        <Input placeholder="Tìm tên GV..." value={qInput} onChange={(e) => setQInput(e.target.value)} />
                        <Button variant="secondary" onClick={load}>Tìm</Button>
                    </div>
                </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm animate-fadeInUp" style={{ animationDelay: "160ms" }}>
                {loading ? (
                    <div className="animate-pulse space-y-2 p-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-3 rounded-xl bg-zinc-50 p-3">
                                <div className="h-8 w-8 rounded-lg bg-zinc-200" />
                                <div className="flex-1 space-y-2"><div className="h-4 w-1/3 rounded bg-zinc-200" /><div className="h-3 w-1/4 rounded bg-zinc-100" /></div>
                                <div className="h-6 w-16 rounded-full bg-zinc-200" />
                            </div>
                        ))}
                    </div>
                ) : !data?.items.length ? (
                    <div className="p-6 text-center text-sm text-zinc-500">Không có dữ liệu</div>
                ) : (
                    <>
                        <Table headers={["Tên", "SĐT", "Trạng thái", "Số HV", "Số buổi", "Hành động"]}>
                            {data.items.map((item, idx) => (
                                <tr key={item.id} className="border-t border-zinc-100 transition-colors hover:bg-zinc-50 animate-fadeInUp" style={{ animationDelay: `${160 + Math.min(idx * 30, 200)}ms` }}>
                                    <td className="px-3 py-2 font-medium text-zinc-900">{item.name}</td>
                                    <td className="px-3 py-2 text-zinc-700">{item.phone || "-"}</td>
                                    <td className="px-3 py-2">{statusBadge(item.status)}</td>
                                    <td className="px-3 py-2 text-zinc-700">{item.studentCount}</td>
                                    <td className="px-3 py-2 text-zinc-700">{item.lessonCount}</td>
                                    <td className="px-3 py-2">
                                        <Link href={`/admin/instructors/${item.id}`} className="text-sm font-medium text-blue-700 hover:underline">
                                            Chi tiết
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </Table>
                        <div className="p-3">
                            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
