"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";

/* ── Image data grouped by category for credibility ── */
const GALLERY_SECTIONS = [
    {
        title: "Lớp Học & Thi Sát Hạch",
        subtitle: "Hàng trăm học viên thi sát hạch mỗi kỳ",
        images: [
            { src: "/images/gallery/1.jpg", alt: "Lớp học lý thuyết đông đảo", aspect: "landscape" },
            { src: "/images/gallery/17.jpg", alt: "Phòng thi sát hạch với giám khảo", aspect: "landscape" },
            { src: "/images/gallery/5.jpg", alt: "Học viên chờ thi sát hạch", aspect: "portrait" },
            { src: "/images/gallery/16.jpg", alt: "Lớp học lý thuyết tại trung tâm", aspect: "landscape" },
        ],
    },
    {
        title: "Tư Vấn & Đăng Ký",
        subtitle: "Đội ngũ tư vấn tận tình, hỗ trợ 1-1",
        images: [
            { src: "/images/gallery/2.jpg", alt: "Nhân viên hướng dẫn đăng ký hồ sơ", aspect: "portrait" },
            { src: "/images/gallery/6.jpg", alt: "Tư vấn trực tiếp tại văn phòng", aspect: "square" },
            { src: "/images/gallery/7.jpg", alt: "Hỗ trợ hoàn tất hồ sơ", aspect: "square" },
            { src: "/images/gallery/8.jpg", alt: "Học viên điền hồ sơ đăng ký", aspect: "square" },
        ],
    },
    {
        title: "Thực Hành & Trang Thiết Bị",
        subtitle: "Xe tập lái mới, cabin mô phỏng hiện đại",
        images: [
            { src: "/images/gallery/14.jpg", alt: "Xe tập lái KIA tại sân tập", aspect: "portrait" },
            { src: "/images/gallery/13.jpg", alt: "Cabin mô phỏng lái xe I2E Smart", aspect: "portrait" },
            { src: "/images/gallery/11.jpg", alt: "Sân tập xe tải rộng rãi", aspect: "portrait" },
            { src: "/images/gallery/10.jpg", alt: "Giám sát viên hướng dẫn thực hành", aspect: "portrait" },
        ],
    },
];

function GalleryImage({ src, alt, index }: { src: string; alt: string; index: number }) {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            ([e]) => { if (e.isIntersecting) { setVisible(true); obs.unobserve(el); } },
            { threshold: 0.15 }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, []);

    return (
        <div
            ref={ref}
            className={`group relative overflow-hidden rounded-xl bg-slate-100 shadow-sm transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                }`}
            style={{ transitionDelay: `${index * 100}ms` }}
        >
            <Image
                src={src}
                alt={alt}
                width={400}
                height={300}
                className="h-[220px] w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <p className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 px-3 py-2 text-xs text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                {alt}
            </p>
        </div>
    );
}

export default function GallerySection() {
    const [activeTab, setActiveTab] = useState(0);

    return (
        <section className="bg-gradient-to-b from-white via-amber-50/30 to-white py-14 md:py-20">
            <div className="mx-auto max-w-[1040px] px-4">
                {/* Section heading */}
                <div className="text-center mb-10">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 mb-3">
                        📸 Hình ảnh thực tế
                    </span>
                    <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">
                        Hình Ảnh Thực Tế Tại Trung Tâm
                    </h2>
                    <p className="mt-2 text-sm text-slate-500 max-w-lg mx-auto">
                        Khám phá không gian học tập, sân tập và trang thiết bị hiện đại tại Đào Tạo Lái Xe Thầy Duy
                    </p>
                </div>

                {/* Category tabs */}
                <div className="flex flex-wrap justify-center gap-2 mb-8">
                    {GALLERY_SECTIONS.map((section, i) => (
                        <button
                            key={section.title}
                            onClick={() => setActiveTab(i)}
                            className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${activeTab === i
                                ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                                : "bg-white text-slate-600 border border-slate-200 hover:border-amber-300 hover:text-amber-600"
                                }`}
                        >
                            {section.title}
                        </button>
                    ))}
                </div>

                {/* Gallery subtitle */}
                <p className="text-center text-sm text-slate-500 mb-6">
                    {GALLERY_SECTIONS[activeTab].subtitle}
                </p>

                {/* Gallery grid */}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                    {GALLERY_SECTIONS[activeTab].images.map((img, i) => (
                        <GalleryImage key={img.src} src={img.src} alt={img.alt} index={i} />
                    ))}
                </div>

                {/* Stats bar */}
                <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
                    {[
                        { icon: "🎓", value: "1,000+", label: "Học viên đã tốt nghiệp" },
                        { icon: "🚛", value: "20+", label: "Xe tập lái mới" },
                        { icon: "📍", value: "2", label: "Chi nhánh hoạt động" },
                        { icon: "⭐", value: "98%", label: "Tỷ lệ đậu" },
                    ].map((stat) => (
                        <div
                            key={stat.label}
                            className="rounded-xl bg-white border border-slate-100 p-4 text-center shadow-sm"
                        >
                            <div className="text-2xl mb-1">{stat.icon}</div>
                            <div className="text-xl font-bold text-slate-900">{stat.value}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{stat.label}</div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
