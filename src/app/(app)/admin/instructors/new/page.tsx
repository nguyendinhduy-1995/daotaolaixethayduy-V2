"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { getToken } from "@/lib/auth-client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { Select } from "@/components/ui/select";

export default function NewInstructorPage() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [status, setStatus] = useState("ACTIVE");
    const [note, setNote] = useState("");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!name.trim()) { setError("Tên giáo viên là bắt buộc"); return; }
        const token = getToken();
        if (!token) { router.replace("/login"); return; }
        setSaving(true);
        setError("");
        try {
            await fetchJson("/api/instructors", {
                token,
                method: "POST",
                body: { name: name.trim(), phone: phone.trim() || null, status, note: note.trim() || null },
            });
            router.push("/admin/instructors");
        } catch (e) {
            const err = e as ApiClientError;
            setError(err.message || "Lỗi tạo giáo viên");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="space-y-4">
            <PageHeader title="Thêm giáo viên mới" subtitle="Điền thông tin bên dưới" />
            {error ? <Alert type="error" message={error} /> : null}
            <SectionCard title="" className="p-6">
                <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-zinc-700">Tên giáo viên *</label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A" required />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-zinc-700">Số điện thoại</label>
                        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0901234567" />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-zinc-700">Trạng thái</label>
                        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                            <option value="ACTIVE">Hoạt động</option>
                            <option value="INACTIVE">Ngừng hoạt động</option>
                        </Select>
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-zinc-700">Ghi chú</label>
                        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú thêm..." />
                    </div>
                    <div className="flex gap-3">
                        <Button type="submit" disabled={saving}>{saving ? "Đang lưu..." : "Tạo giáo viên"}</Button>
                        <Button variant="secondary" type="button" onClick={() => router.push("/admin/instructors")}>Huỷ</Button>
                    </div>
                </form>
            </SectionCard>
        </div>
    );
}
