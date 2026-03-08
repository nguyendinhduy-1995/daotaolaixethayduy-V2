"use client";

import { useState, useCallback, useEffect } from "react";
import { RevealSection, formatVnd, PROVINCES, LICENSE_TYPES, HOTLINE_TEL } from "./LandingStyles";

type TuitionItem = {
    id: string;
    province: string;
    licenseType: string;
    tuition: number;
    tuitionFormatted: string;
};

interface Props {
    scrollTo: (id: string) => void;
}

export default function PricingSection({ scrollTo }: Props) {
    const [selectedProvince, setSelectedProvince] = useState("Hồ Chí Minh");
    const [selectedLicense, setSelectedLicense] = useState("");
    const [tuitionData, setTuitionData] = useState<TuitionItem[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchTuition = useCallback(async (province: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/public/tuition-plans?province=${encodeURIComponent(province)}`);
            const data = await res.json();
            setTuitionData(data.items || []);
        } catch {
            setTuitionData([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchTuition(selectedProvince); }, [selectedProvince, fetchTuition]);

    const filtered = selectedLicense
        ? tuitionData.filter((t) => t.licenseType === selectedLicense)
        : tuitionData;

    return (
        <section
            className="relative py-12 md:py-16"
            style={{ background: "linear-gradient(180deg, #fffbeb 0%, #fff 100%)" }}
        >
            <div className="mx-auto max-w-[1040px] px-4">
                <RevealSection>
                    {(visible) => (
                        <div className={visible ? "ld-fade-up" : "opacity-0"}>
                            {/* Header */}
                            <div className="text-center mb-6">
                                <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 border border-amber-200/60 px-3 py-1 text-xs font-bold text-amber-700 mb-3">
                                    💰 Học phí trọn gói — Không phát sinh
                                </div>
                                <h2 className="text-xl font-extrabold text-slate-900 md:text-2xl tracking-tight">
                                    Bảng Giá Học Phí
                                </h2>
                                <p className="mt-1.5 text-sm text-slate-500">
                                    Chọn tỉnh / thành và hạng bằng để xem học phí chi tiết
                                </p>
                            </div>

                            {/* Filters */}
                            <div className="mx-auto max-w-md grid grid-cols-2 gap-3 mb-6">
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-slate-600">Tỉnh / Thành</label>
                                    <select
                                        value={selectedProvince}
                                        onChange={(e) => setSelectedProvince(e.target.value)}
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm transition focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                                    >
                                        {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-slate-600">Hạng bằng</label>
                                    <select
                                        value={selectedLicense}
                                        onChange={(e) => setSelectedLicense(e.target.value)}
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm transition focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                                    >
                                        <option value="">Tất cả</option>
                                        {LICENSE_TYPES.map((l) => <option key={l} value={l}>{l}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Cards */}
                            <div>
                                {loading ? (
                                    <div className="flex items-center justify-center py-10">
                                        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                                        <span className="ml-2 text-sm text-slate-400">Đang tải...</span>
                                    </div>
                                ) : filtered.length === 0 ? (
                                    <div className="rounded-2xl border border-slate-200/60 bg-white p-6 text-center shadow-sm">
                                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-2xl">📋</div>
                                        <p className="mt-3 text-sm font-medium text-slate-600">Chưa có dữ liệu học phí cho khu vực này</p>
                                        <p className="mt-1 text-xs text-slate-400">Liên hệ tư vấn trực tiếp để biết mức giá</p>
                                        <div className="mt-4 flex flex-wrap justify-center gap-3">
                                            <button onClick={() => setSelectedProvince("Hồ Chí Minh")} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">Chọn tỉnh khác</button>
                                            <a href={HOTLINE_TEL} className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-amber-600">📞 Gọi tư vấn</a>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                                        {filtered.map((item, idx) => (
                                            <div
                                                key={item.id}
                                                className={`group relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5 ${visible ? `ld-scale-in ld-d${Math.min(idx + 1, 6)}` : "opacity-0"}`}
                                                style={{ border: "1px solid rgba(0,0,0,0.06)" }}
                                            >
                                                {/* Popular badge for first */}
                                                {idx === 0 && (
                                                    <div className="absolute top-0 right-0 rounded-bl-xl bg-amber-500 px-2.5 py-1 text-[10px] font-bold text-white">
                                                        Phổ biến
                                                    </div>
                                                )}
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <p className="text-base font-bold text-slate-900">{item.licenseType}</p>
                                                        <p className="text-[11px] text-slate-400 mt-0.5">{item.province} · Trọn gói</p>
                                                    </div>
                                                </div>
                                                <p className="mt-3 text-2xl font-black text-amber-600">
                                                    {formatVnd(item.tuition)}₫
                                                </p>
                                                <ul className="mt-3 space-y-1.5">
                                                    {["Bao gồm lý thuyết + thực hành", "Xe tập mới, sân rộng", "Cam kết đậu sát hạch"].map((f) => (
                                                        <li key={f} className="flex items-center gap-1.5 text-xs text-slate-600">
                                                            <svg width="12" height="12" viewBox="0 0 20 20" fill="#10b981"><circle cx="10" cy="10" r="10" /><path d="M6 10l3 3 5-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
                                                            {f}
                                                        </li>
                                                    ))}
                                                </ul>
                                                <button
                                                    onClick={() => scrollTo("dang-ky")}
                                                    className="mt-4 w-full rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 active:scale-[0.97]"
                                                >
                                                    Giữ suất học
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </RevealSection>
            </div>
        </section>
    );
}
