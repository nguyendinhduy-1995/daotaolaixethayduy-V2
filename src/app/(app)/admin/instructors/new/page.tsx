"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { getToken } from "@/lib/auth-client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
            {/* ── Premium Header ── */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-teal-600 via-cyan-600 to-sky-600 p-4 text-white shadow-lg shadow-teal-200 animate-fadeInUp">
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
                <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/10 blur-xl" />
                <div className="relative flex flex-wrap items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-2xl backdrop-blur-sm">➕</div>
                    <div className="flex-1">
                        <h2 className="text-lg font-bold">Thêm giáo viên mới</h2>
                        <p className="text-sm text-white/80">Điền thông tin bên dưới</p>
                    </div>
                </div>
            </div>
            {error ? <Alert type="error" message={error} /> : null}
            <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm animate-fadeInUp" style={{ animationDelay: "80ms" }}>
                <div className="h-1 bg-gradient-to-r from-teal-500 to-cyan-500" />
                <div className="p-6">
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
                </div>
            </div>
        </div>
    );
}
