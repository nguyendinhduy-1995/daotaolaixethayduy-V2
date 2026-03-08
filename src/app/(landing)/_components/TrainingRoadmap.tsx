"use client";

import { RevealSection } from "./LandingStyles";

const STEPS = [
    {
        step: 1,
        phase: "Giai đoạn 1",
        title: "Lý thuyết linh hoạt",
        timing: "Học ngay khi khai giảng",
        icon: "📖",
        color: "#2563eb",
        bullets: [
            "Bận rộn? Học Online tại nhà qua App.",
            "Cần giải thích kỹ? Đến lớp nghe Thầy giảng trực tiếp.",
        ],
        goal: "Nắm chắc luật, thuộc 600 câu (đặc biệt câu điểm liệt) để tự tin ra đường.",
    },
    {
        step: 2,
        phase: "Giai đoạn 2",
        title: "Thực hành Sa hình",
        timing: "Song song lý thuyết",
        icon: "🚗",
        color: "#d97706",
        bullets: [
            "Thực hành ngay để \"khớp\" kiến thức với thực tế.",
            "Luyện kỹ bài khó: Đề-pa lên dốc, Ghép xe dọc/ngang, Qua vệt bánh xe...",
        ],
        goal: null,
    },
    {
        step: 3,
        phase: "Giai đoạn 3",
        title: "Chạy DAT & Đường trường",
        timing: "",
        icon: "🛣️",
        color: "#059669",
        bullets: [
            "Chạy đủ số km quy định (DAT).",
            "Thực chiến đường phố, xử lý tình huống thực tế.",
        ],
        goal: null,
    },
    {
        step: 4,
        phase: "Giai đoạn 4",
        title: "Tổng ôn & Thi tốt nghiệp",
        timing: "",
        icon: "🏆",
        color: "#dc2626",
        bullets: [
            "Thi thử như thi thật để ổn định tâm lý.",
            "Rà soát toàn bộ kỹ năng để tối ưu tỷ lệ đậu.",
        ],
        goal: null,
    },
];

export default function TrainingRoadmap() {
    return (
        <section className="py-12 md:py-16" style={{ background: "linear-gradient(180deg, #f8fafc 0%, #fff 100%)" }}>
            <div className="mx-auto max-w-[1040px] px-4">
                <RevealSection>
                    {(visible) => (
                        <div className={visible ? "ld-fade-up" : "opacity-0"}>
                            {/* Header */}
                            <div className="text-center mb-8">
                                <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200/60 px-3 py-1 text-xs font-bold text-slate-600 mb-3">
                                    📋 Lộ trình rõ ràng — Đậu ngay lần đầu
                                </div>
                                <h2 className="text-xl font-extrabold text-slate-900 md:text-2xl tracking-tight">
                                    Lộ Trình Đào Tạo 4 Bước
                                </h2>
                                <p className="mt-1.5 text-sm text-slate-500">
                                    Hiểu luật – Chạy vững – Thi chắc
                                </p>
                            </div>

                            {/* Steps grid */}
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4">
                                {STEPS.map((s, idx) => (
                                    <div
                                        key={s.step}
                                        className={`relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5 ${visible ? `ld-scale-in ld-d${idx + 1}` : "opacity-0"}`}
                                        style={{ border: "1px solid rgba(0,0,0,0.06)" }}
                                    >
                                        {/* Top accent bar */}
                                        <div className="absolute top-0 left-0 right-0 h-1" style={{ background: s.color }} />

                                        <div className="flex items-center gap-3 mb-3">
                                            <div
                                                className="flex h-10 w-10 items-center justify-center rounded-xl text-lg"
                                                style={{ background: `${s.color}12` }}
                                            >
                                                {s.icon}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: s.color }}>
                                                        {s.phase}
                                                    </span>
                                                    {s.timing && (
                                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{s.timing}</span>
                                                    )}
                                                </div>
                                                <p className="text-sm font-bold text-slate-900">{s.title}</p>
                                            </div>
                                        </div>

                                        <ul className="space-y-1.5 mb-2">
                                            {s.bullets.map((b, i) => (
                                                <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                                                    <span className="mt-0.5 flex-shrink-0" style={{ color: s.color }}>✓</span>
                                                    <span>{b}</span>
                                                </li>
                                            ))}
                                        </ul>

                                        {s.goal && (
                                            <div className="rounded-lg bg-blue-50 px-3 py-2">
                                                <p className="text-[11px] font-medium text-blue-700">
                                                    🎯 {s.goal}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </RevealSection>
            </div>
        </section>
    );
}
