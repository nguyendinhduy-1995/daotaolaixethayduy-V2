"use client";

import { useState, useRef, useEffect } from "react";

const REVIEWS = [
    {
        name: "Hoàng Minh",
        license: "B (số tự động)",
        rating: 5,
        text: "Học ở Thầy Duy rất thoải mái, lịch linh hoạt nên đi làm vẫn sắp xếp được. Thầy dạy tận tình, thi đậu lần đầu luôn!",
        province: "Vĩnh Long",
        daysToPass: 85,
    },
    {
        name: "Thu Hà",
        license: "B (số sàn)",
        rating: 5,
        text: "Mình lo lắng lắm vì lái xe gì cũng sợ. Nhưng thầy kiên nhẫn chỉ từng bước, giờ tự tin ra đường rồi!",
        province: "Tiền Giang",
        daysToPass: 90,
    },
    {
        name: "Văn Tùng",
        license: "C1",
        rating: 5,
        text: "Quy trình rõ ràng, không phát sinh ngoài ý muốn. Đóng tiền theo mốc nên rất yên tâm. Đậu ngay lần đầu!",
        province: "Hồ Chí Minh",
        daysToPass: 95,
    },
    {
        name: "Ngọc Ánh",
        license: "B (số tự động)",
        rating: 5,
        text: "Thích nhất là học online lý thuyết tại nhà. Thực hành thì xe mới, sân tập rộng, thầy dạy rất kỹ.",
        province: "Bình Dương",
        daysToPass: 80,
    },
    {
        name: "Phúc Hậu",
        license: "B (số sàn)",
        rating: 4,
        text: "Giá cả hợp lý. Quan trọng là học xong thật sự biết lái, không phải học cho qua. Recommend!",
        province: "Sóc Trăng",
        daysToPass: 88,
    },
    {
        name: "Thanh Trúc",
        license: "B (số tự động)",
        rating: 5,
        text: "Chị bạn giới thiệu nên đăng ký. Nhân viên nhiệt tình, đăng ký xong 2 tuần vào học liền. Tốt lắm!",
        province: "Cần Thơ",
        daysToPass: 82,
    },
    {
        name: "Quốc Đại",
        license: "C1",
        rating: 5,
        text: "Học C1 tưởng khó nhưng lộ trình bài bản giúp hiểu rõ từng bước. Giờ đi làm lái xe tải rồi!",
        province: "Đồng Nai",
        daysToPass: 100,
    },
    {
        name: "Mỹ Linh",
        license: "B (số tự động)",
        rating: 5,
        text: "Rất sợ lái xe nhưng nhờ thầy dạy tận tâm, luyện nhiều tình huống thực tế nên giờ tự tin lái trên đường.",
        province: "Vĩnh Long",
        daysToPass: 92,
    },
    {
        name: "Anh Khoa",
        license: "B lên C",
        rating: 5,
        text: "Nâng hạng B lên C nhanh gọn. Thủ tục đơn giản, mang hồ sơ là trung tâm lo. 3 tháng có bằng mới.",
        province: "Tiền Giang",
        daysToPass: 90,
    },
    {
        name: "Bích Ngọc",
        license: "B (số tự động)",
        rating: 5,
        text: "Con gái mà học lái xe cũng OK! Thầy rất kiên nhẫn, không la mắng. Cabin mô phỏng giúp quen trước khi ra xe thật.",
        province: "Hồ Chí Minh",
        daysToPass: 78,
    },
];

function getInitials(name: string) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
    "linear-gradient(135deg, #f59e0b, #d97706)",
    "linear-gradient(135deg, #3b82f6, #2563eb)",
    "linear-gradient(135deg, #10b981, #059669)",
    "linear-gradient(135deg, #f43f5e, #e11d48)",
    "linear-gradient(135deg, #8b5cf6, #7c3aed)",
    "linear-gradient(135deg, #06b6d4, #0891b2)",
    "linear-gradient(135deg, #eab308, #ca8a04)",
    "linear-gradient(135deg, #84cc16, #65a30d)",
    "linear-gradient(135deg, #ec4899, #db2777)",
    "linear-gradient(135deg, #14b8a6, #0d9488)",
];

type Review = typeof REVIEWS[0];

function ReviewCard({ review, index }: { review: Review; index: number }) {
    return (
        <div
            className="relative rounded-2xl bg-white p-4 md:p-5 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
            style={{
                border: "1px solid rgba(0,0,0,0.06)",
            }}
        >
            {/* Quote icon */}
            <div className="absolute top-3 right-3 text-amber-200 text-2xl md:text-3xl leading-none select-none pointer-events-none" style={{ fontFamily: "Georgia, serif" }}>
                &ldquo;
            </div>

            {/* Stars at top */}
            <div className="flex gap-0.5 mb-3">
                {Array.from({ length: 5 }).map((_, i) => (
                    <svg key={i} width="14" height="14" viewBox="0 0 20 20" fill={i < review.rating ? "#f59e0b" : "#e2e8f0"}>
                        <path d="M10 1l2.39 4.84 5.34.78-3.87 3.77.91 5.32L10 13.27l-4.77 2.51.91-5.32L2.27 6.62l5.34-.78L10 1z" />
                    </svg>
                ))}
            </div>

            {/* Review text */}
            <p className="text-[13px] leading-relaxed text-slate-700 mb-3 md:text-sm md:mb-4 line-clamp-4">
                {review.text}
            </p>

            {/* Divider */}
            <div className="h-px bg-slate-100 mb-3" />

            {/* Author row */}
            <div className="flex items-center gap-2.5">
                <div
                    className="flex h-9 w-9 md:h-10 md:w-10 flex-shrink-0 items-center justify-center rounded-full text-[11px] md:text-xs font-bold text-white shadow-sm"
                    style={{ background: AVATAR_COLORS[index % AVATAR_COLORS.length] }}
                >
                    {getInitials(review.name)}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <p className="text-[13px] font-semibold text-slate-900 truncate">{review.name}</p>
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" className="flex-shrink-0">
                            <circle cx="10" cy="10" r="10" fill="#10b981" />
                            <path d="M6 10l3 3 5-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <p className="text-[11px] text-slate-400">{review.license} · {review.province}</p>
                </div>
            </div>
        </div>
    );
}

export default function TestimonialsSection() {
    const sectionRef = useRef<HTMLElement>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const el = sectionRef.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            ([e]) => { if (e.isIntersecting) { setVisible(true); obs.unobserve(el); } },
            { threshold: 0.05 }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, []);

    return (
        <section
            ref={sectionRef}
            className="relative overflow-hidden py-14 md:py-20"
            style={{
                background: "linear-gradient(180deg, #fffbeb 0%, #fef3c7 30%, #fef9c3 60%, #fffff0 100%)",
            }}
        >
            {/* Decorative background elements */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #fbbf24 0%, transparent 70%)" }} />
                <div className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full opacity-15" style={{ background: "radial-gradient(circle, #f59e0b 0%, transparent 70%)" }} />
            </div>

            <div className={`relative z-10 mx-auto max-w-[1040px] px-4 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
                {/* ── Header Block ── */}
                <div className="text-center mb-8 md:mb-12">
                    {/* Trust badge */}
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/80 backdrop-blur-sm border border-amber-200/60 px-4 py-2 shadow-sm mb-4">
                        <div className="flex -space-x-1">
                            {[0, 1, 2, 3].map(i => (
                                <div
                                    key={i}
                                    className="h-6 w-6 rounded-full border-2 border-white text-[8px] font-bold text-white flex items-center justify-center"
                                    style={{ background: AVATAR_COLORS[i] }}
                                >
                                    {getInitials(REVIEWS[i].name)}
                                </div>
                            ))}
                        </div>
                        <span className="text-xs font-semibold text-slate-700">5,000+ học viên đã đánh giá</span>
                    </div>

                    <h2 className="text-2xl font-extrabold text-slate-900 md:text-4xl tracking-tight">
                        Học Viên Nói Gì<br className="md:hidden" /> Về Thầy Duy?
                    </h2>
                    <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto md:text-base">
                        Hàng ngàn học viên đã tin tưởng và tốt nghiệp thành công
                    </p>

                    {/* Aggregate rating */}
                    <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/90 backdrop-blur-sm border border-amber-200/40 px-5 py-2.5 shadow-sm">
                        <div className="flex gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <svg key={i} width="18" height="18" viewBox="0 0 20 20" fill="#f59e0b">
                                    <path d="M10 1l2.39 4.84 5.34.78-3.87 3.77.91 5.32L10 13.27l-4.77 2.51.91-5.32L2.27 6.62l5.34-.78L10 1z" />
                                </svg>
                            ))}
                        </div>
                        <span className="text-lg font-black text-slate-900">4.9</span>
                        <span className="text-xs text-slate-500">/5 trung bình</span>
                    </div>
                </div>

                {/* ── Review Grid: 2 cols mobile, 3 cols desktop ── */}
                <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-4">
                    {REVIEWS.slice(0, 6).map((review, i) => (
                        <div
                            key={review.name}
                            className={`transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
                            style={{ transitionDelay: `${i * 80}ms` }}
                        >
                            <ReviewCard review={review} index={i} />
                        </div>
                    ))}
                </div>

                {/* ── Expandable section ── */}
                <ExpandableReviews reviews={REVIEWS.slice(6)} startIndex={6} visible={visible} />

                {/* ── Bottom trust bar ── */}
                <div className={`mt-8 md:mt-12 transition-all duration-700 delay-500 ${visible ? "opacity-100" : "opacity-0"}`}>
                    <div
                        className="rounded-2xl p-4 md:p-6 text-center"
                        style={{
                            background: "linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(217,119,6,0.12) 100%)",
                            border: "1px solid rgba(245,158,11,0.15)",
                        }}
                    >
                        <div className="grid grid-cols-3 gap-3 md:gap-6">
                            {[
                                { value: "5,000+", label: "Học viên tốt nghiệp", icon: "🎓" },
                                { value: "98%", label: "Đậu sát hạch", icon: "✅" },
                                { value: "4.9★", label: "Đánh giá trung bình", icon: "⭐" },
                            ].map((stat) => (
                                <div key={stat.label}>
                                    <span className="text-lg md:text-xl">{stat.icon}</span>
                                    <p className="text-lg font-black text-slate-900 md:text-2xl">{stat.value}</p>
                                    <p className="text-[10px] text-slate-500 md:text-xs">{stat.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

function ExpandableReviews({ reviews, startIndex, visible }: { reviews: Review[]; startIndex: number; visible: boolean }) {
    const [expanded, setExpanded] = useState(false);

    if (reviews.length === 0) return null;

    return (
        <>
            {expanded && (
                <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-4 mt-2.5 md:mt-4">
                    {reviews.map((review, i) => (
                        <div
                            key={review.name}
                            className="transition-all duration-500 opacity-100 translate-y-0"
                            style={{ transitionDelay: `${i * 80}ms` }}
                        >
                            <ReviewCard review={review} index={startIndex + i} />
                        </div>
                    ))}
                </div>
            )}
            <div className={`text-center mt-4 transition-all duration-700 delay-300 ${visible ? "opacity-100" : "opacity-0"}`}>
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:shadow-md hover:border-amber-300 hover:text-amber-700 active:scale-[0.97]"
                >
                    {expanded ? (
                        <>Thu gọn <span className="text-xs">▲</span></>
                    ) : (
                        <>Xem thêm {reviews.length} đánh giá <span className="text-xs">▼</span></>
                    )}
                </button>
            </div>
        </>
    );
}
