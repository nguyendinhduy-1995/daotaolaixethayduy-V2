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
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SectionCard } from "@/components/ui/section-card";
import { Spinner } from "@/components/ui/spinner";
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
    const [q, setQ] = useState("");
    const [page, setPage] = useState(1);
    const pageSize = 20;

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
            <PageHeader
                title="Giáo viên thực hành"
                subtitle={`${data?.total ?? 0} giáo viên`}
                actions={
                    <Link href="/admin/instructors/new">
                        <Button>+ Thêm giáo viên</Button>
                    </Link>
                }
            />

            {error ? <Alert type="error" message={error} /> : null}

            <SectionCard title="" className="p-4">
                <div className="flex flex-wrap items-end gap-3">
                    <Input placeholder="Tìm tên GV..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
                    <Button variant="secondary" onClick={load}>Tìm</Button>
                </div>
            </SectionCard>

            <SectionCard title="" className="p-0">
                {loading ? (
                    <div className="flex items-center gap-2 p-6 text-zinc-700"><Spinner /> Đang tải...</div>
                ) : !data?.items.length ? (
                    <div className="p-6 text-center text-sm text-zinc-500">Không có dữ liệu</div>
                ) : (
                    <>
                        <Table headers={["Tên", "SĐT", "Trạng thái", "Số HV", "Số buổi", "Hành động"]}>
                            {data.items.map((item) => (
                                <tr key={item.id} className="border-t border-zinc-100">
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
            </SectionCard>
        </div>
    );
}
