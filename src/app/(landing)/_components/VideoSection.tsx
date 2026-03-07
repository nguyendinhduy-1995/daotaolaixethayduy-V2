"use client";

import { useState, useRef, useEffect } from "react";

const VIDEOS = [
    {
        src: "/videos/review-1.mp4",
        title: "Review từ học viên Khá",
        description: "Chia sẻ trải nghiệm thực tế khi học lái xe tại Thầy Duy",
    },
    {
        src: "/videos/review-2.mp4",
        title: "Chia sẻ từ chị Lụa",
        description: "Quá trình học và thi sát hạch thành công",
    },
];

export default function VideoSection() {
    const [activeVideo, setActiveVideo] = useState(0);
    const [isVisible, setIsVisible] = useState(false);
    const sectionRef = useRef<HTMLElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const el = sectionRef.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            ([e]) => { if (e.isIntersecting) { setIsVisible(true); obs.unobserve(el); } },
            { threshold: 0.1 }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, []);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.load();
        }
    }, [activeVideo]);

    return (
        <section
            ref={sectionRef}
            className="bg-slate-900 py-14 md:py-20"
        >
            <div className="mx-auto max-w-[1040px] px-4">
                {/* Section heading */}
                <div className={`text-center mb-10 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-400 mb-3">
                        🎬 Video chia sẻ
                    </span>
                    <h2 className="text-2xl font-bold text-white md:text-3xl">
                        Học Viên Nói Gì Về Chúng Tôi?
                    </h2>
                    <p className="mt-2 text-sm text-slate-400 max-w-lg mx-auto">
                        Nghe chia sẻ thực tế từ những học viên đã hoàn thành khóa học tại Đào Tạo Lái Xe Thầy Duy
                    </p>
                </div>

                <div className={`grid gap-6 md:grid-cols-[1fr_280px] transition-all duration-700 delay-200 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
                    {/* Main video player */}
                    <div className="relative overflow-hidden rounded-2xl bg-black shadow-2xl shadow-amber-500/10">
                        <video
                            ref={videoRef}
                            className="w-full aspect-video"
                            controls
                            preload="metadata"
                            playsInline
                            poster=""
                        >
                            <source src={VIDEOS[activeVideo].src} type="video/mp4" />
                            Trình duyệt không hỗ trợ video.
                        </video>
                        <div className="absolute top-3 left-3 rounded-lg bg-black/60 backdrop-blur-sm px-3 py-1.5">
                            <p className="text-xs font-semibold text-white">{VIDEOS[activeVideo].title}</p>
                        </div>
                    </div>

                    {/* Video list sidebar */}
                    <div className="flex flex-row gap-3 md:flex-col overflow-x-auto md:overflow-visible">
                        {VIDEOS.map((video, i) => (
                            <button
                                key={video.src}
                                onClick={() => setActiveVideo(i)}
                                className={`flex-shrink-0 w-[200px] md:w-full rounded-xl p-3 text-left transition-all ${activeVideo === i
                                    ? "bg-amber-500/20 border border-amber-500/40"
                                    : "bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800"
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm ${activeVideo === i
                                        ? "bg-amber-500 text-white"
                                        : "bg-slate-700 text-slate-400"
                                        }`}>
                                        {activeVideo === i ? "▶" : (i + 1)}
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`text-sm font-medium truncate ${activeVideo === i ? "text-amber-400" : "text-slate-300"}`}>
                                            {video.title}
                                        </p>
                                        <p className="text-xs text-slate-500 truncate mt-0.5">
                                            {video.description}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        ))}

                        {/* CTA card */}
                        <div className="flex-shrink-0 w-[200px] md:w-full rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 p-4 text-center mt-auto">
                            <p className="text-xs text-amber-400 font-medium mb-1">Bạn muốn như họ?</p>
                            <p className="text-xs text-slate-500">Đăng ký ngay để bắt đầu hành trình lái xe!</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
