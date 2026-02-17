"use client";

import { RevealSection } from "./LandingStyles";

const STEPS = [
    { step: 1, title: "Xếp lớp", desc: "Sắp xếp vào khóa học gần nhất", icon: "📋" },
    { step: 2, title: "Báo lịch", desc: "Nhận lịch học chi tiết qua Zalo/App", icon: "📅" },
    { step: 3, title: "Đào tạo", desc: "Học lý thuyết + thực hành theo lộ trình", icon: "🚗" },
    { step: 4, title: "Chạy DAT", desc: "Tích lũy đủ km quy định trên DAT", icon: "🛣️" },
    { step: 5, title: "Thi sát hạch", desc: "Thi tốt nghiệp lấy bằng lái", icon: "🏆" },
];

export default function PostEnrollRoadmap() {
    return (
        <section className="bg-slate-50 py-10 md:py-14">
            <div className="mx-auto max-w-[1040px] px-4">
                <RevealSection>
                    {(visible) => (
                        <div className={visible ? "ld-fade-up" : "opacity-0"}>
                            <h2 className="text-center text-lg font-semibold text-slate-900 md:text-xl">
                                Sau Khi Nộp Hồ Sơ – 5 Bước Khép Kín
                            </h2>
                            <p className="mt-1 text-center text-sm text-slate-500">
                                Yên tâm mọi thứ đã có Thầy Duy lo
                            </p>

                            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                                {STEPS.map((s, idx) => (
                                    <div
                                        key={s.step}
                                        className={`flex flex-col items-center rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm text-center transition-shadow hover:shadow-md ${visible ? `ld-scale-in ld-d${idx + 1}` : "opacity-0"
                                            }`}
                                    >
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-white shadow-sm">
                                            {s.step}
                                        </div>
                                        <span className="mt-2 text-lg">{s.icon}</span>
                                        <h3 className="mt-1 text-xs font-semibold text-slate-900 md:text-sm">{s.title}</h3>
                                        <p className="mt-0.5 text-[10px] text-slate-500 md:text-xs">{s.desc}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Cam kết vận hành */}
                            <div className="mt-6 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100/50 p-5 text-center">
                                <p className="text-sm font-semibold text-amber-700">
                                    ⚡ Cam kết vận hành
                                </p>
                                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                                    Thầy Duy cam kết theo sát học viên từ ngày đầu hồ sơ đến ngày nhận bằng.
                                    Hỗ trợ 24/7 qua Zalo và đường dây nóng.
                                </p>
                            </div>
                        </div>
                    )}
                </RevealSection>
            </div>
        </section>
    );
}
