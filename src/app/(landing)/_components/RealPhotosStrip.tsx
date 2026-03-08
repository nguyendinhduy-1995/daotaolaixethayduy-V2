"use client";

import { useRef, useState, useEffect } from "react";
import Image from "next/image";

const PHOTOS = [
    { src: "/images/gallery/1.jpg", alt: "Xe tập lái KIA mới" },
    { src: "/images/gallery/3.jpg", alt: "Sân tập rộng rãi" },
    { src: "/images/gallery/4.jpg", alt: "Đào tạo thực hành" },
    { src: "/images/gallery/9.jpg", alt: "Lớp học đông đảo" },
    { src: "/images/gallery/12.jpg", alt: "Cabin mô phỏng" },
    { src: "/images/gallery/14.jpg", alt: "Trang thiết bị hiện đại" },
    { src: "/images/gallery/18.jpg", alt: "Học viên thi sát hạch" },
    { src: "/images/gallery/10.jpg", alt: "Giám sát viên hướng dẫn" },
];

// Duplicate for infinite scroll
const SCROLL_PHOTOS = [...PHOTOS, ...PHOTOS];

export default function RealPhotosStrip() {
    const sectionRef = useRef<HTMLElement>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const el = sectionRef.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            ([e]) => { if (e.isIntersecting) { setVisible(true); obs.unobserve(el); } },
            { threshold: 0.1 }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, []);

    return (
        <section
            ref={sectionRef}
            className={`relative overflow-hidden py-10 md:py-14 transition-all duration-700 ${visible ? "opacity-100" : "opacity-0"}`}
            style={{ background: "linear-gradient(180deg, #fff 0%, #fffbeb 40%, #fef3c7 70%, #fff 100%)" }}
        >
            {/* Heading with CTA */}
            <div className="mx-auto max-w-[1040px] px-4 mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="h-1 w-6 rounded-full bg-amber-400" />
                            <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Hình ảnh thực tế</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 md:text-xl">
                            Cơ Sở Vật Chất & Đào Tạo
                        </h3>
                    </div>
                    <span className="hidden md:inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/60 px-3 py-1 text-xs font-semibold text-emerald-700">
                        ✓ Cập nhật tháng 3/2026
                    </span>
                </div>
            </div>

            {/* Marquee container */}
            <div className="relative">
                {/* Gradient edges */}
                <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-16 bg-gradient-to-r from-white to-transparent md:w-24" />
                <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-16 bg-gradient-to-l from-white to-transparent md:w-24" />

                <style dangerouslySetInnerHTML={{
                    __html: `
                    @keyframes marquee-scroll {
                        0% { transform: translateX(0); }
                        100% { transform: translateX(-50%); }
                    }
                    .photos-marquee {
                        animation: marquee-scroll 35s linear infinite;
                    }
                    .photos-marquee:hover {
                        animation-play-state: paused;
                    }
                `}} />

                {/* Scrolling photos */}
                <div className="photos-marquee flex gap-3 md:gap-4 w-max">
                    {SCROLL_PHOTOS.map((photo, i) => (
                        <div
                            key={`${photo.src}-${i}`}
                            className="group relative flex-shrink-0 overflow-hidden rounded-xl shadow-md"
                            style={{ width: "220px", height: "160px" }}
                        >
                            <Image
                                src={photo.src}
                                alt={photo.alt}
                                width={220}
                                height={160}
                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                                loading="lazy"
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom stat strip */}
            <div className="mx-auto max-w-[1040px] px-4 mt-6">
                <div className="flex items-center justify-center gap-4 md:gap-8 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                        <span className="text-base">🚗</span>
                        <span><strong className="text-slate-700">20+</strong> xe tập lái mới</span>
                    </span>
                    <span className="h-3 w-px bg-slate-200" />
                    <span className="flex items-center gap-1.5">
                        <span className="text-base">🏫</span>
                        <span><strong className="text-slate-700">5</strong> sân tập chuyên dụng</span>
                    </span>
                    <span className="h-3 w-px bg-slate-200 hidden md:block" />
                    <span className="hidden md:flex items-center gap-1.5">
                        <span className="text-base">📱</span>
                        <span>Cabin mô phỏng hiện đại</span>
                    </span>
                </div>
            </div>
        </section>
    );
}
