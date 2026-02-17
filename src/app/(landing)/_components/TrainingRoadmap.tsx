"use client";

import { RevealSection } from "./LandingStyles";

const STEPS = [
    {
        step: 1,
        phase: "Giai đoạn 1",
        title: "Lý thuyết linh hoạt",
        timing: "Học ngay khi khai giảng",
        icon: "📖",
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
        bullets: [
            "Thực hành ngay để \"khớp\" kiến thức với thực tế, không phải chờ học xong lý thuyết.",
            "Luyện kỹ bài khó: Đề-pa lên dốc, Ghép xe dọc/ngang, Qua vệt bánh xe...",
        ],
        goal: null,
    },
    {
        step: 3,
        phase: "Giai đoạn 3",
        title: "Chạy DAT & Đường trường thực tế",
        timing: "",
        icon: "🛣️",
        bullets: [
            "Chạy đủ số km quy định (DAT).",
            "Thực chiến đường phố đông đúc, xử lý tình huống thực tế chứ không học vẹt.",
        ],
        goal: null,
    },
    {
        step: 4,
        phase: "Giai đoạn 4",
        title: "Tổng ôn & Thi tốt nghiệp",
        timing: "",
        icon: "🏆",
        bullets: [
            "Thi thử như thi thật để ổn định tâm lý.",
            "Rà soát toàn bộ kỹ năng để tối ưu tỷ lệ đậu.",
        ],
        goal: null,
    },
];

export default function TrainingRoadmap() {
    return (
        <section className="bg-slate-50 py-10 md:py-14">
            <div className="mx-auto max-w-[1040px] px-4">
                <RevealSection>
                    {(visible) => (
                        <div className={visible ? "ld-fade-up" : "opacity-0"}>
                            <h2 className="text-center text-lg font-semibold uppercase tracking-wide text-slate-900 md:text-xl">
                                Lộ Trình Đào Tạo 4 Bước – Đỗ Ngay Lần Đầu Cùng Thầy Duy
                            </h2>
                            <p className="mt-1 text-center text-sm text-slate-500">
                                Hiểu luật – Chạy vững – Thi chắc.
                            </p>

                            <div className="relative mt-8">
                                <div className="absolute left-5 top-0 h-full w-0.5 bg-gradient-to-b from-amber-500 via-amber-400 to-amber-300 md:left-6" />

                                <div className="space-y-5">
                                    {STEPS.map((s, idx) => (
                                        <div
                                            key={s.step}
                                            className={`relative flex items-start gap-4 md:gap-5 ${visible ? `ld-slide-r ld-d${idx + 1}` : "opacity-0"}`}
                                        >
                                            <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500 text-lg font-bold text-white shadow-sm md:h-12 md:w-12">
                                                {s.step}
                                            </div>
                                            <div className="flex-1 rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg">{s.icon}</span>
                                                    <div>
                                                        <h3 className="text-sm font-semibold text-slate-900 md:text-base">
                                                            {s.phase}: {s.title}
                                                        </h3>
                                                        {s.timing && (
                                                            <span className="text-[10px] font-medium text-amber-600">{s.timing}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <ul className="mt-2 space-y-1.5">
                                                    {s.bullets.map((b, i) => (
                                                        <li key={i} className="flex items-start gap-2 text-xs text-slate-600 md:text-sm">
                                                            <span className="mt-0.5 text-amber-500">•</span>
                                                            <span>{b}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                                {s.goal && (
                                                    <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2">
                                                        <p className="text-xs font-medium text-amber-700">
                                                            🎯 Mục tiêu: {s.goal}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </RevealSection>
            </div>
        </section>
    );
}
