"use client";

import { RevealSection } from "./LandingStyles";

interface Props {
    scrollTo: (id: string) => void;
}

const STEPS = [
    {
        heading: "Ngày 1: Lên trung tâm đăng ký hồ sơ",
        desc: "Hoàn tất đăng ký, kiểm tra điều kiện, hướng dẫn giấy tờ và vào danh sách lớp.",
    },
    {
        heading: "Ngày 2: Học lý thuyết & kiểm tra lý thuyết",
        desc: "Nếu bận, học viên có thể dời lịch theo sắp xếp của Phòng Đào Tạo.",
        pill: "Có thể dời lịch",
    },
    {
        heading: "Ngày 3: Chạy DAT",
        desc: "Chạy DAT để đủ điều kiện thi theo quy định.",
    },
    {
        heading: "Ngày 4: Thi tốt nghiệp",
        desc: "Thi cấp chứng chỉ (tốt nghiệp) theo lịch nhà trường.",
    },
    {
        heading: "Ngày 5: Thi sát hạch",
        desc: "Thi sát hạch theo lịch Sở để hoàn tất và nhận bằng.",
    },
];

export default function UpgradeProcess({ scrollTo }: Props) {
    return (
        <section
            id="upgrade-timeline"
            className="mx-auto max-w-[1040px] px-4 py-10 md:py-14"
            style={{ scrollMarginTop: 96 }}
        >
            <RevealSection>
                {(visible) => (
                    <div className={visible ? "ld-fade-up" : "opacity-0"}>
                        {/* ── Title + Sub ── */}
                        <h2 className="mx-auto max-w-[52ch] text-center text-[20px] font-semibold tracking-tight text-slate-900 md:text-[28px]">
                            Quy trình nâng hạng – Chỉ cần có mặt 5 ngày
                        </h2>
                        <p className="mx-auto mt-2 max-w-[52ch] text-center text-[13px] leading-relaxed text-slate-600 md:text-[15px]">
                            Để học viên chủ động thời gian: 2&nbsp;–&nbsp;2,5
                            tháng có bằng. Tổng cộng chỉ cần có mặt 5 ngày theo các mốc dưới
                            đây.
                        </p>

                        {/* ── Stepper ── */}
                        <div className="relative mt-8 md:mt-10">
                            {/* vertical line */}
                            <div className="absolute left-[15px] top-0 h-full w-0.5 bg-amber-300 md:left-[17px]" />

                            <div className="space-y-3.5 md:space-y-[18px]">
                                {STEPS.map((s, idx) => (
                                    <div
                                        key={idx}
                                        className={`relative grid items-start gap-3 md:gap-4 ${visible ? `ld-slide-r ld-d${Math.min(idx + 1, 6)}` : "opacity-0"}`}
                                        style={{ gridTemplateColumns: "44px 1fr" }}
                                    >
                                        {/* circle */}
                                        <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-semibold text-white shadow-sm md:h-9 md:w-9 md:text-sm">
                                            {idx + 1}
                                        </div>

                                        {/* card */}
                                        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm transition-[box-shadow,border-color] duration-200 hover:border-slate-200 hover:shadow-md md:p-5">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="text-[15px] font-semibold leading-snug text-slate-900 md:text-base">
                                                    {s.heading}
                                                </h3>
                                                {s.pill && (
                                                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                                                        {s.pill}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-1 text-[13px] leading-relaxed text-slate-600 md:text-sm">
                                                {s.desc}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ── Info box ── */}
                        <div className="mt-6 rounded-2xl border border-amber-200/70 bg-amber-50 p-4 md:mt-8">
                            <div className="flex items-start gap-2.5">
                                <span className="mt-0.5 text-lg text-amber-600" aria-hidden>
                                    ⚡
                                </span>
                                <div>
                                    <p className="text-[14px] font-semibold text-slate-900 md:text-[15px]">
                                        Lưu ý quan trọng
                                    </p>
                                    <p className="mt-1 max-w-[60ch] text-[13px] leading-relaxed text-slate-700 md:text-sm">
                                        Mốc thời gian 2&nbsp;–&nbsp;2,5 tháng phụ thuộc lịch thi
                                        của Sở và lịch tổ chức của nhà trường. Các bước còn lại được
                                        nhắc lịch và hướng dẫn qua Zalo để học viên chủ động sắp
                                        xếp.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* ── CTA ── */}
                        <div className="mt-5 text-center">
                            <button
                                onClick={() => scrollTo("dang-ky")}
                                className="rounded-xl bg-amber-500 px-6 py-3 text-sm font-bold text-white shadow-md shadow-amber-500/20 transition hover:bg-amber-600 active:scale-[0.97]"
                            >
                                Đăng ký nâng hạng
                            </button>
                        </div>
                    </div>
                )}
            </RevealSection>
        </section>
    );
}
