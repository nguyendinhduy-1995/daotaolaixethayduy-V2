"use client";

interface Props {
    scrollTo: (id: string) => void;
}

export default function HeroSection({ scrollTo }: Props) {
    return (
        <section
            className="relative overflow-hidden"
            style={{
                background: "linear-gradient(135deg, #FFF8E7 0%, #FFF3CD 50%, #FFEAA0 100%)",
            }}
        >
            <div className="mx-auto max-w-[1040px] px-4 py-12 md:py-20">
                <h1 className="ld-fade-up text-[28px] font-semibold leading-[1.12] tracking-tight text-slate-900 md:text-[34px]">
                    Học lái xe nhanh –<br />
                    <span className="text-amber-600">Đúng quy trình</span>
                </h1>
                <p className="ld-fade-up ld-d1 mt-3 max-w-lg text-sm leading-relaxed text-slate-600 md:text-base">
                    Đào tạo lái xe uy tín, giáo viên tận tâm, cam kết đậu. Hỗ trợ trọn gói từ hồ sơ đến ngày thi.
                </p>

                <div className="ld-fade-up ld-d2 mt-6 flex flex-wrap gap-3">
                    <button
                        onClick={() => scrollTo("dang-ky")}
                        className="ld-pulse inline-flex items-center rounded-xl bg-amber-500 px-6 py-3 text-sm font-bold text-white shadow-md shadow-amber-500/20 transition hover:bg-amber-600 active:scale-[0.97]"
                    >
                        ĐĂNG KÝ NGAY
                    </button>
                    <button
                        onClick={() => scrollTo("pricing")}
                        className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 active:scale-[0.97]"
                    >
                        XEM HỌC PHÍ
                    </button>
                </div>

                <div className="ld-fade-up ld-d3 mt-8 flex flex-wrap gap-2">
                    {[
                        { icon: "📁", label: "Hồ Sơ Uy Tín" },
                        { icon: "📅", label: "Lịch Học Linh Hoạt" },
                        { icon: "🏅", label: "Cam Kết Đậu" },
                    ].map((b) => (
                        <span
                            key={b.label}
                            className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm backdrop-blur"
                        >
                            {b.icon} {b.label}
                        </span>
                    ))}
                </div>
            </div>

            <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 1440 60" preserveAspectRatio="none">
                <path fill="#ffffff" d="M0,40 C480,80 960,0 1440,40 L1440,60 L0,60 Z" />
            </svg>
        </section>
    );
}
