"use client";

import { RevealSection } from "./LandingStyles";

interface Props {
    scrollTo: (id: string) => void;
}

const STEPS = [
    {
        step: 1,
        title: "Giữ chỗ",
        amount: "3.000.000₫",
        desc: "Đóng 3.000.000₫ làm hồ sơ. Xếp lớp vào khóa khai giảng gần nhất.",
        icon: "📝",
        accent: "#d97706",
    },
    {
        step: 2,
        title: "Khai giảng đóng đủ 50%",
        amount: "50%",
        desc: "Đóng tiếp số còn lại để tổng đạt 50% học phí.",
        icon: "📚",
        accent: "#059669",
    },
    {
        step: 3,
        title: "Hoàn tất 50% khi chạy DAT",
        amount: "50%",
        desc: "Phần còn lại hoàn thành trước khi chạy DAT.",
        icon: "🏁",
        accent: "#2563eb",
    },
];

export default function PaymentSteps({ scrollTo }: Props) {
    return (
        <section className="py-10 md:py-14" style={{ background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)" }}>
            <div className="mx-auto max-w-[1040px] px-4">
                <RevealSection>
                    {(visible) => (
                        <div className={visible ? "ld-fade-up" : "opacity-0"}>
                            {/* Header */}
                            <div className="text-center mb-8">
                                <h2 className="text-xl font-extrabold text-slate-900 md:text-2xl tracking-tight">
                                    Học B/C1: Đóng Tiền Gọn – Giữ Chỗ Chắc
                                </h2>
                                <p className="mt-1.5 text-sm text-slate-500">
                                    Đặt cọc trước, đóng theo mốc rõ ràng — không phát sinh
                                </p>
                            </div>

                            {/* Horizontal steps on desktop, vertical on mobile */}
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
                                {STEPS.map((s, idx) => (
                                    <div
                                        key={s.step}
                                        className={`relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5 ${visible ? `ld-scale-in ld-d${idx + 1}` : "opacity-0"}`}
                                        style={{ border: "1px solid rgba(0,0,0,0.06)" }}
                                    >
                                        {/* Step connector arrow (desktop only) */}
                                        {idx < STEPS.length - 1 && (
                                            <div className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10">
                                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white text-[10px]">→</div>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-3 mb-3">
                                            <div
                                                className="flex h-10 w-10 items-center justify-center rounded-xl text-lg"
                                                style={{ background: `${s.accent}15` }}
                                            >
                                                {s.icon}
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: s.accent }}>
                                                    Bước {s.step}
                                                </p>
                                                <p className="text-sm font-bold text-slate-900">{s.title}</p>
                                            </div>
                                        </div>

                                        <p className="text-xs text-slate-500 leading-relaxed mb-3">{s.desc}</p>

                                        <div
                                            className="rounded-lg px-3 py-2 text-center"
                                            style={{ background: `${s.accent}08`, border: `1px solid ${s.accent}15` }}
                                        >
                                            <span className="text-lg font-black" style={{ color: s.accent }}>{s.amount}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* CTA */}
                            <div className="mt-6 text-center">
                                <button
                                    onClick={() => scrollTo("dang-ky")}
                                    className="ld-pulse inline-flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition hover:bg-amber-600 active:scale-[0.97]"
                                >
                                    ✍️ Giữ suất học ngay
                                </button>
                            </div>
                        </div>
                    )}
                </RevealSection>
            </div>
        </section>
    );
}
