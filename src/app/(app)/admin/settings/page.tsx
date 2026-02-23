"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, fetchMe, getToken } from "@/lib/auth-client";
import { hasUiPermission } from "@/lib/ui-permissions";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type FeatureSetting = {
    id: string;
    key: string;
    enabled: boolean;
    config: unknown;
    updatedAt: string;
};

type BranchItem = {
    id: string;
    name: string;
    code: string | null;
    provinces: string[];
    isActive: boolean;
};

const FEATURE_DEFINITIONS: Record<string, { label: string; description: string; icon: string }> = {
    auto_assign_by_province: {
        label: "Tự động phân data theo tỉnh",
        description: "Khi bật, lead mới từ landing page sẽ tự động được gán cho chi nhánh phù hợp (theo tỉnh thành) và round-robin cho nhân viên trong chi nhánh đó.",
        icon: "🔀",
    },
};

function parseApiError(error: ApiClientError) {
    return `${error.code}: ${error.message}`;
}

export default function AdminSettingsPage() {
    const toast = useToast();
    const [checkingAccess, setCheckingAccess] = useState(true);
    const [allowed, setAllowed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [settings, setSettings] = useState<FeatureSetting[]>([]);
    const [branches, setBranches] = useState<BranchItem[]>([]);
    const [editBranch, setEditBranch] = useState<BranchItem | null>(null);
    const [provincesInput, setProvincesInput] = useState("");
    const [branchSaving, setBranchSaving] = useState(false);

    useEffect(() => {
        fetchMe()
            .then((data) => {
                const ok = hasUiPermission(data.user.permissions, "admin_automation_admin", "VIEW");
                setAllowed(ok);
            })
            .catch(() => clearToken())
            .finally(() => setCheckingAccess(false));
    }, []);

    const loadSettings = useCallback(async () => {
        const token = getToken();
        if (!token) return;
        const data = await fetchJson<{ items: FeatureSetting[] }>("/api/admin/settings", { token });
        setSettings(data.items || []);
    }, []);

    const loadBranches = useCallback(async () => {
        const token = getToken();
        if (!token) return;
        try {
            const data = await fetchJson<{ items: BranchItem[] }>("/api/admin/branches?page=1&pageSize=100", { token });
            setBranches(data.items || []);
        } catch {
            setBranches([]);
        }
    }, []);

    useEffect(() => {
        if (!allowed) return;
        setLoading(true);
        Promise.all([loadSettings(), loadBranches()])
            .catch((e) => setError(`Lỗi tải dữ liệu: ${parseApiError(e as ApiClientError)}`))
            .finally(() => setLoading(false));
    }, [allowed, loadSettings, loadBranches]);

    async function toggleFeature(key: string, enabled: boolean) {
        const token = getToken();
        if (!token) return;
        setSaving(key);
        setError("");
        try {
            await fetchJson("/api/admin/settings", {
                method: "POST",
                token,
                body: { key, enabled },
            });
            toast.success(`${enabled ? "Đã bật" : "Đã tắt"} tính năng.`);
            await loadSettings();
        } catch (e) {
            setError(parseApiError(e as ApiClientError));
        } finally {
            setSaving(null);
        }
    }

    function getSettingValue(key: string) {
        return settings.find((s) => s.key === key);
    }

    function openBranchEdit(branch: BranchItem) {
        setEditBranch(branch);
        setProvincesInput((branch.provinces || []).join(", "));
    }

    async function saveBranchProvinces() {
        if (!editBranch) return;
        const token = getToken();
        if (!token) return;
        setBranchSaving(true);
        setError("");
        try {
            const provinces = provincesInput
                .split(",")
                .map((p) => p.trim())
                .filter(Boolean);
            await fetchJson(`/api/admin/branches/${editBranch.id}`, {
                method: "PATCH",
                token,
                body: { provinces },
            });
            toast.success("Đã lưu tỉnh thành cho chi nhánh.");
            setEditBranch(null);
            await loadBranches();
        } catch (e) {
            setError(parseApiError(e as ApiClientError));
        } finally {
            setBranchSaving(false);
        }
    }

    if (checkingAccess) {
        return (
            <div className="flex items-center gap-2 text-zinc-700">
                <Spinner /> Đang kiểm tra quyền...
            </div>
        );
    }

    if (!allowed) {
        return <Alert type="error" message="Bạn không có quyền truy cập" />;
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-4 text-white shadow-lg shadow-emerald-200 animate-fadeInUp">
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
                <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/10 blur-xl" />
                <div className="relative flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-2xl backdrop-blur-sm">⚙️</div>
                    <div className="flex-1">
                        <h2 className="text-lg font-bold">Cài đặt tính năng</h2>
                        <p className="text-sm text-white/80">Bật/tắt các tính năng nâng cao của hệ thống</p>
                    </div>
                </div>
            </div>

            {error ? <Alert type="error" message={error} /> : null}
            {loading ? (
                <div className="animate-pulse space-y-3">
                    {[1, 2].map((i) => <div key={i} className="h-24 rounded-2xl bg-zinc-200" />)}
                </div>
            ) : null}

            {/* Feature Toggles */}
            {!loading && Object.entries(FEATURE_DEFINITIONS).map(([key, def]) => {
                const setting = getSettingValue(key);
                const enabled = setting?.enabled || false;
                const isSaving = saving === key;

                return (
                    <div key={key} className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm animate-fadeInUp" style={{ animationDelay: "80ms" }}>
                        <div className={`h-1 bg-gradient-to-r ${enabled ? "from-emerald-500 to-teal-500" : "from-zinc-300 to-zinc-400"}`} />
                        <div className="p-4">
                            <div className="flex items-start gap-3">
                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${enabled ? "bg-emerald-100" : "bg-zinc-100"}`}>
                                    {def.icon}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-bold text-zinc-900">{def.label}</h3>
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${enabled ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
                                            {enabled ? "BẬT" : "TẮT"}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-sm text-zinc-500">{def.description}</p>
                                </div>
                                <button
                                    type="button"
                                    disabled={isSaving}
                                    onClick={() => toggleFeature(key, !enabled)}
                                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${enabled ? "bg-emerald-500" : "bg-zinc-300"} ${isSaving ? "opacity-50" : ""}`}
                                >
                                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enabled ? "translate-x-5" : "translate-x-0"}`} />
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })}

            {/* Branch-Province Mapping */}
            {!loading && (
                <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm animate-fadeInUp" style={{ animationDelay: "160ms" }}>
                    <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
                    <div className="p-4">
                        <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-900">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-sm">🏢</span>
                            Mapping chi nhánh → tỉnh thành
                        </h3>
                        <p className="mt-1 text-xs text-zinc-500">
                            Thiết lập tỉnh thành cho mỗi chi nhánh để auto-assign hoạt động chính xác.
                        </p>

                        <div className="mt-3 space-y-2">
                            {branches.map((branch) => (
                                <div key={branch.id} className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50/50 p-3">
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-zinc-900">{branch.name}</p>
                                        <p className="text-xs text-zinc-500">
                                            {branch.provinces && branch.provinces.length > 0
                                                ? branch.provinces.join(", ")
                                                : "Chưa thiết lập tỉnh thành"}
                                        </p>
                                    </div>
                                    <Button variant="secondary" className="!text-xs" onClick={() => openBranchEdit(branch)}>
                                        Sửa
                                    </Button>
                                </div>
                            ))}
                            {branches.length === 0 ? (
                                <p className="text-sm text-zinc-500 text-center py-4">Chưa có chi nhánh nào.</p>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Branch Provinces Modal */}
            {editBranch && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                    <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
                        <h3 className="text-base font-bold text-zinc-900">Sửa tỉnh thành: {editBranch.name}</h3>
                        <p className="mt-1 text-xs text-zinc-500">Nhập danh sách tỉnh, cách nhau bằng dấu phẩy. Ví dụ: TPHCM, Hồ Chí Minh, Bình Dương</p>
                        <textarea
                            className="mt-3 w-full rounded-xl border border-zinc-300 bg-white p-3 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                            rows={3}
                            value={provincesInput}
                            onChange={(e) => setProvincesInput(e.target.value)}
                        />
                        <div className="mt-3 flex justify-end gap-2">
                            <Button variant="secondary" onClick={() => setEditBranch(null)}>Huỷ</Button>
                            <Button onClick={saveBranchProvinces} disabled={branchSaving}>
                                {branchSaving ? "Đang lưu..." : "Lưu"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
