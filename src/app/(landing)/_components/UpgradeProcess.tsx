"use client";

import { RevealSection } from "./LandingStyles";

interface Props {
    scrollTo: (id: string) => void;
}

const STEPS = [
    {
        heading: "Ngày 1",
        title: "Lên trung tâm đăng ký hồ sơ",
        desc: "Hoàn tất đăng ký, kiểm tra điều kiện, hướng dẫn giấy tờ.",
        icon: "📋",
    },
    {
        heading: "Ngày 2",
        title: "Học lý thuyết & kiểm tra",
        desc: "Nếu bận, học viên có thể dời lịch theo sắp xếp.",
        icon: "📚",
        pill: "Linh hoạt",
    },
    {
        heading: "Ngày 3",
        title: "Chạy DAT",
        desc: "Chạy DAT để đủ điều kiện thi theo quy định.",
        icon: "🛣️",
    },
    {
        heading: "Ngày 4",
        title: "Thi tốt nghiệp",
        desc: "Thi cấp chứng chỉ theo lịch nhà trường.",
        icon: "📝",
    },
    {
        heading: "Ngày 5",
        title: "Thi sát hạch – Nhận bằng",
        desc: "Thi sát hạch theo lịch Sở, hoàn tất nhận bằng.",
        icon: "🏆",
    },
];

export default function UpgradeProcess({ scrollTo }: Props) {
    return (
        <section
            id="upgrade-timeline"
            className="py-12 md:py-16"
            style={{ scrollMarginTop: 96, background: "linear-gradient(180deg, #fff 0%, #fffbeb 100%)" }}
        >
            <div className="mx-auto max-w-[1040px] px-4">
                <RevealSection>
                    {(visible) => (
                        <div className={visible ? "ld-fade-up" : "opacity-0"}>
                            {/* Header */}
                            <div className="text-center mb-8">
                                <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 border border-amber-200/60 px-3 py-1 text-xs font-bold text-amber-700 mb-3">
                                    ⚡ Chỉ cần có mặt 5 ngày
                                </div>
                                <h2 className="text-xl font-extrabold text-slate-900 md:text-2xl tracking-tight">
                                    Quy Trình Nâng Hạng
                                </h2>
                                <p className="mt-1.5 text-sm text-slate-500 max-w-md mx-auto">
                                    2 – 2,5 tháng có bằng. Chủ động thời gian, chỉ cần có mặt 5 ngày
                                </p>
                            </div>

                            {/* Horizontal timeline on desktop, stacked on mobile */}
                            <div className="relative">
                                {/* Connection line - desktop */}
                                <div className="hidden md:block absolute top-[28px] left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-amber-300 via-amber-500 to-amber-300 z-0" />

                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 md:gap-2">
                                    {STEPS.map((s, idx) => (
                                        <div
                                            key={idx}
                                            className={`relative flex flex-col items-center text-center ${visible ? `ld-scale-in ld-d${idx + 1}` : "opacity-0"}`}
                                        >
                                            {/* Circle */}
                                            <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-md border border-slate-100 text-xl mb-3">
                                                {s.icon}
                                            </div>

                                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-1">
                                                {s.heading}
                                            </span>
                                            <h3 className="text-xs font-bold text-slate-900 leading-snug mb-1 md:text-sm">{s.title}</h3>
                                            <p className="text-[11px] text-slate-500 leading-relaxed">{s.desc}</p>

                                            {s.pill && (
                                                <span className="mt-1.5 inline-flex rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
                                                    {s.pill}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Info + CTA */}
                            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between rounded-2xl bg-amber-50 border border-amber-200/60 p-5">
                                <div className="flex items-start gap-3">
                                    <span className="text-lg">⚡</span>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">Lưu ý quan trọng</p>
                                        <p className="text-xs text-slate-600 mt-0.5 max-w-md">
                                            Mốc thời gian phụ thuộc lịch thi của Sở. Các bước được nhắc lịch qua Zalo.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => scrollTo("dang-ky")}
                                    className="shrink-0 rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-amber-500/20 transition hover:bg-amber-600 active:scale-[0.97]"
                                >
                                    Đăng ký nâng hạng
                                </button>
                            </div>
                        </div>
                    )}
                </RevealSection>
            </div>
        </section>
    );
}
