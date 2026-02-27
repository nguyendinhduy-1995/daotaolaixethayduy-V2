"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, fetchMe, getToken } from "@/lib/auth-client";
import { hasUiPermission } from "@/lib/ui-permissions";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";

type FeatureSetting = {
    id: string;
    key: string;
    enabled: boolean;
    config: unknown;
    updatedAt: string;
};

/* ── Landing page definitions ── */
const LANDING_PAGES: {
    key: string;
    featureKey: string;
    label: string;
    description: string;
    icon: string;
    path: string;
}[] = [
        {
            key: "bo-doi-xuat-ngu",
            featureKey: "landing_bo_doi_xuat_ngu",
            label: "Bộ Đội Xuất Ngũ",
            description: "Trang đăng ký học lái xe miễn phí 100% cho bộ đội xuất ngũ — hạng B & C1",
            icon: "🪖",
            path: "/bo-doi-xuat-ngu",
        },
        // thêm landing mới ở đây
    ];

function parseApiError(error: ApiClientError) {
    return `${error.code}: ${error.message}`;
}

export default function AdminLandingsPage() {
    const toast = useToast();
    const [checkingAccess, setCheckingAccess] = useState(true);
    const [allowed, setAllowed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [settings, setSettings] = useState<FeatureSetting[]>([]);

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

    useEffect(() => {
        if (!allowed) return;
        setLoading(true);
        loadSettings()
            .catch((e) => setError(`Lỗi tải dữ liệu: ${parseApiError(e as ApiClientError)}`))
            .finally(() => setLoading(false));
    }, [allowed, loadSettings]);

    async function toggleLanding(featureKey: string, enabled: boolean) {
        const token = getToken();
        if (!token) return;
        setSaving(featureKey);
        setError("");
        try {
            await fetchJson("/api/admin/settings", {
                method: "POST",
                token,
                body: { key: featureKey, enabled },
            });
            toast.success(`${enabled ? "Đã bật" : "Đã tắt"} trang landing.`);
            await loadSettings();
        } catch (e) {
            setError(parseApiError(e as ApiClientError));
        } finally {
            setSaving(null);
        }
    }

    function isLandingEnabled(featureKey: string) {
        const setting = settings.find((s) => s.key === featureKey);
        // Default: enabled if no setting exists
        return setting ? setting.enabled : true;
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
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 p-4 text-white shadow-lg shadow-purple-200 animate-fadeInUp">
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
                <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/10 blur-xl" />
                <div className="relative flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-2xl backdrop-blur-sm">🌐</div>
                    <div className="flex-1">
                        <h2 className="text-lg font-bold">Quản lý Landing Pages</h2>
                        <p className="text-sm text-white/80">Bật/tắt các trang landing, theo dõi trạng thái</p>
                    </div>
                </div>
            </div>

            {error ? <Alert type="error" message={error} /> : null}
            {loading ? (
                <div className="animate-pulse space-y-3">
                    {[1, 2].map((i) => <div key={i} className="h-28 rounded-2xl bg-zinc-200" />)}
                </div>
            ) : null}

            {/* Landing Page Cards */}
            {!loading && LANDING_PAGES.map((lp, idx) => {
                const enabled = isLandingEnabled(lp.featureKey);
                const isSaving = saving === lp.featureKey;

                return (
                    <div
                        key={lp.key}
                        className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm animate-fadeInUp"
                        style={{ animationDelay: `${(idx + 1) * 80}ms` }}
                    >
                        <div className={`h-1 bg-gradient-to-r ${enabled ? "from-emerald-500 to-teal-500" : "from-zinc-300 to-zinc-400"}`} />
                        <div className="p-4">
                            <div className="flex items-start gap-3">
                                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ${enabled ? "bg-emerald-100" : "bg-zinc-100"}`}>
                                    {lp.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="text-sm font-bold text-zinc-900">{lp.label}</h3>
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${enabled ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                                            {enabled ? "ĐANG BẬT" : "ĐÃ TẮT"}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-sm text-zinc-500">{lp.description}</p>
                                    <div className="mt-2 flex items-center gap-3">
                                        <a
                                            href={lp.path}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100"
                                        >
                                            🔗 {lp.path}
                                        </a>
                                        {!enabled && (
                                            <span className="text-xs text-red-500">⚠️ Trang đang hiển thị "Tạm ngưng"</span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    disabled={isSaving}
                                    onClick={() => toggleLanding(lp.featureKey, !enabled)}
                                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${enabled ? "bg-emerald-500" : "bg-zinc-300"} ${isSaving ? "opacity-50" : ""}`}
                                >
                                    <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enabled ? "translate-x-5" : "translate-x-0"}`} />
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })}

            {!loading && LANDING_PAGES.length === 0 && (
                <div className="rounded-2xl border border-zinc-100 bg-white p-8 text-center shadow-sm">
                    <p className="text-sm text-zinc-500">Chưa có trang landing nào được cấu hình.</p>
                </div>
            )}
        </div>
    );
}
