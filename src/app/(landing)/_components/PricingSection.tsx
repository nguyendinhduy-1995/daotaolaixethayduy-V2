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
        <section className="mx-auto max-w-[1040px] px-4 py-10 md:py-14">
            <RevealSection>
                {(visible) => (
                    <div className={visible ? "ld-fade-up" : "opacity-0"}>
                        <h2 className="text-center text-lg font-semibold text-slate-900 md:text-xl">
                            Bảng Giá Học Phí
                        </h2>
                        <p className="mt-1 text-center text-sm text-slate-500">
                            Chọn tỉnh / thành và hạng bằng để xem học phí
                        </p>

                        {/* Bộ lọc */}
                        <div className="mt-6 grid grid-cols-2 gap-3">
                            <div>
                                <label className="mb-1 block text-xs font-medium text-slate-600">Chọn Tỉnh / Thành</label>
                                <select
                                    value={selectedProvince}
                                    onChange={(e) => setSelectedProvince(e.target.value)}
                                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 transition focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                                >
                                    {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-medium text-slate-600">Hạng bằng</label>
                                <select
                                    value={selectedLicense}
                                    onChange={(e) => setSelectedLicense(e.target.value)}
                                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 transition focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                                >
                                    <option value="">Tất cả</option>
                                    {LICENSE_TYPES.map((l) => <option key={l} value={l}>{l}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Cards layout */}
                        <div className="mt-5">
                            {loading ? (
                                <div className="flex items-center justify-center py-10">
                                    <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                                    <span className="ml-2 text-sm text-slate-400">Đang tải...</span>
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="rounded-2xl border border-slate-200/60 bg-white p-6 text-center shadow-sm">
                                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
                                        📋
                                    </div>
                                    <p className="mt-3 text-sm font-medium text-slate-600">
                                        Chưa có dữ liệu học phí cho khu vực này
                                    </p>
                                    <p className="mt-1 text-xs text-slate-400">
                                        Thử chọn tỉnh khác hoặc liên hệ tư vấn trực tiếp
                                    </p>
                                    <div className="mt-4 flex flex-wrap justify-center gap-3">
                                        <button
                                            onClick={() => setSelectedProvince("Hồ Chí Minh")}
                                            className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.97]"
                                        >
                                            Chọn tỉnh khác
                                        </button>
                                        <a
                                            href={HOTLINE_TEL}
                                            className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-amber-600 active:scale-[0.97]"
                                        >
                                            📞 Nhắn Zalo hỏi giá
                                        </a>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                                    {filtered.map((item, idx) => (
                                        <div
                                            key={item.id}
                                            className={`rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${visible ? `ld-scale-in ld-d${Math.min(idx + 1, 6)}` : "opacity-0"}`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-semibold leading-snug text-slate-900">{item.licenseType}</p>
                                                    <p className="mt-0.5 text-[10px] text-slate-400">{item.province}</p>
                                                </div>
                                                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                                    Trọn gói
                                                </span>
                                            </div>
                                            <p className="mt-3 text-xl font-bold text-amber-600">
                                                {formatVnd(item.tuition)}₫
                                            </p>
                                            <div className="mt-3 flex gap-2">
                                                <button
                                                    onClick={() => scrollTo("dang-ky")}
                                                    className="flex-1 rounded-lg border border-slate-300 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.97]"
                                                >
                                                    Nhận tư vấn
                                                </button>
                                                <button
                                                    onClick={() => scrollTo("dang-ky")}
                                                    className="flex-1 rounded-lg bg-amber-500 py-2 text-xs font-bold text-white transition hover:bg-amber-600 active:scale-[0.97]"
                                                >
                                                    Giữ suất học
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </RevealSection>
        </section>
    );
}
