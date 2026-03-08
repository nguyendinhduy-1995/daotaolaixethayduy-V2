"use client";

import { RevealSection } from "./LandingStyles";

const STEPS = [
    { step: 1, title: "Xếp lớp", desc: "Sắp xếp vào khóa gần nhất", icon: "📋", color: "#2563eb" },
    { step: 2, title: "Báo lịch", desc: "Nhận lịch qua Zalo/App", icon: "📅", color: "#7c3aed" },
    { step: 3, title: "Đào tạo", desc: "Lý thuyết + Thực hành", icon: "🚗", color: "#d97706" },
    { step: 4, title: "Chạy DAT", desc: "Tích lũy đủ km quy định", icon: "🛣️", color: "#059669" },
    { step: 5, title: "Thi sát hạch", desc: "Thi & nhận bằng lái", icon: "🏆", color: "#dc2626" },
];

export default function PostEnrollRoadmap() {
    return (
        <section className="py-12 md:py-16" style={{ background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)" }}>
            <div className="mx-auto max-w-[1040px] px-4">
                <RevealSection>
                    {(visible) => (
                        <div className={visible ? "ld-fade-up" : "opacity-0"}>
                            {/* Header */}
                            <div className="text-center mb-8">
                                <h2 className="text-xl font-extrabold text-slate-900 md:text-2xl tracking-tight">
                                    Sau Khi Nộp Hồ Sơ – 5 Bước Khép Kín
                                </h2>
                                <p className="mt-1.5 text-sm text-slate-500">
                                    Yên tâm — mọi thứ đã có Thầy Duy lo từ A đến Z
                                </p>
                            </div>

                            {/* Steps as connected cards */}
                            <div className="relative">
                                {/* Desktop connecting line */}
                                <div className="hidden md:block absolute top-[28px] left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-blue-300 via-amber-400 to-red-300 z-0" />

                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 md:gap-2">
                                    {STEPS.map((s, idx) => (
                                        <div
                                            key={s.step}
                                            className={`relative flex flex-col items-center text-center ${visible ? `ld-scale-in ld-d${idx + 1}` : "opacity-0"}`}
                                        >
                                            {/* Icon */}
                                            <div
                                                className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-md text-xl mb-3"
                                                style={{ border: `2px solid ${s.color}30` }}
                                            >
                                                {s.icon}
                                            </div>

                                            <span
                                                className="text-[10px] font-bold uppercase tracking-wider mb-1"
                                                style={{ color: s.color }}
                                            >
                                                Bước {s.step}
                                            </span>
                                            <h3 className="text-xs font-bold text-slate-900 md:text-sm">{s.title}</h3>
                                            <p className="text-[11px] text-slate-500 mt-0.5">{s.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Commitment bar */}
                            <div className="mt-8 rounded-2xl bg-white border border-slate-200/60 shadow-sm p-5">
                                <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-5">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-xl shrink-0">⚡</div>
                                    <div className="text-center sm:text-left">
                                        <p className="text-sm font-bold text-slate-900">Cam kết vận hành</p>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            Thầy Duy theo sát từ ngày nộp hồ sơ đến ngày nhận bằng. Hỗ trợ 24/7 qua Zalo.
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0 text-[11px] text-slate-500">
                                        <span className="flex items-center gap-1">
                                            <svg width="12" height="12" viewBox="0 0 20 20" fill="#10b981"><circle cx="10" cy="10" r="10" /><path d="M6 10l3 3 5-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
                                            Miễn phí
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <svg width="12" height="12" viewBox="0 0 20 20" fill="#10b981"><circle cx="10" cy="10" r="10" /><path d="M6 10l3 3 5-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
                                            24/7
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </RevealSection>
            </div>
        </section>
    );
}
