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
    },
    {
        step: 2,
        title: "Khai giảng đóng đủ 50%",
        amount: "50%",
        desc: "Đóng tiếp số còn lại để tổng đạt 50% học phí.",
    },
    {
        step: 3,
        title: "Hoàn tất 50% khi chạy DAT",
        amount: "50%",
        desc: "Phần còn lại hoàn thành trước khi chạy DAT.",
    },
];

export default function PaymentSteps({ scrollTo }: Props) {
    return (
        <section className="bg-slate-50 py-10 md:py-14">
            <div className="mx-auto max-w-[1040px] px-4">
                <RevealSection>
                    {(visible) => (
                        <div className={visible ? "ld-fade-up" : "opacity-0"}>
                            <h2 className="text-center text-lg font-semibold text-slate-900 md:text-xl">
                                Học B/C1: Đóng tiền gọn – giữ chỗ chắc
                            </h2>
                            <p className="mt-1 text-center text-sm text-slate-500">
                                Đặt cọc trước, đóng theo mốc rõ ràng.
                            </p>

                            <div className="relative mt-8">
                                <div className="absolute left-5 top-0 h-full w-0.5 bg-gradient-to-b from-amber-500 via-amber-400 to-amber-300 md:left-6" />

                                <div className="space-y-5">
                                    {STEPS.map((s, idx) => (
                                        <div
                                            key={s.step}
                                            className={`relative flex items-start gap-4 md:gap-5 ${visible ? `ld-slide-r ld-d${idx + 1}` : "opacity-0"}`}
                                        >
                                            <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500 text-base font-bold text-white shadow-sm md:h-12 md:w-12">
                                                {s.step}
                                            </div>
                                            <div className="flex-1 rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-sm font-semibold text-slate-900 md:text-base">{s.title}</h3>
                                                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                                                        {s.amount}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-xs text-slate-500 md:text-sm">{s.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-6 text-center">
                                <button
                                    onClick={() => scrollTo("dang-ky")}
                                    className="ld-pulse rounded-xl bg-amber-500 px-6 py-3 text-sm font-bold text-white shadow-md shadow-amber-500/20 transition hover:bg-amber-600 active:scale-[0.97]"
                                >
                                    Giữ suất học
                                </button>
                            </div>
                        </div>
                    )}
                </RevealSection>
            </div>
        </section>
    );
}
