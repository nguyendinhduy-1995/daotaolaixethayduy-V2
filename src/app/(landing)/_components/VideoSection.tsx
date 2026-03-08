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
            className="relative overflow-hidden py-14 md:py-20"
            style={{ background: "linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)" }}
        >
            {/* Decorative glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-[0.06] pointer-events-none" style={{ background: "radial-gradient(circle, #f59e0b 0%, transparent 70%)" }} />

            <div className="relative z-10 mx-auto max-w-[1040px] px-4">
                {/* Heading */}
                <div className={`text-center mb-8 md:mb-10 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-4 py-2 mb-4">
                        <span className="text-sm">🎬</span>
                        <span className="text-xs font-semibold text-slate-300">Video chia sẻ thực tế</span>
                    </div>
                    <h2 className="text-2xl font-extrabold text-white md:text-3xl tracking-tight">
                        Nghe Học Viên Chia Sẻ
                    </h2>
                    <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">
                        Trải nghiệm thực tế từ những người đã học thành công
                    </p>
                </div>

                {/* Video tabs */}
                <div className={`flex justify-center gap-2 mb-5 transition-all duration-700 delay-100 ${isVisible ? "opacity-100" : "opacity-0"}`}>
                    {VIDEOS.map((video, i) => (
                        <button
                            key={video.src}
                            onClick={() => setActiveVideo(i)}
                            className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all ${activeVideo === i
                                    ? "bg-amber-500 text-white shadow-lg shadow-amber-500/25"
                                    : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
                                }`}
                        >
                            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${activeVideo === i ? "bg-white/20" : "bg-white/5"
                                }`}>
                                {activeVideo === i ? "▶" : (i + 1)}
                            </span>
                            {video.title}
                        </button>
                    ))}
                </div>

                {/* Video player — centered, premium frame */}
                <div className={`flex justify-center transition-all duration-700 delay-200 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
                    <div className="relative w-full max-w-[380px]">
                        {/* Outer glow ring */}
                        <div className="absolute -inset-1 rounded-[20px] bg-gradient-to-b from-amber-500/20 via-transparent to-amber-500/10 blur-sm" />

                        <div className="relative overflow-hidden rounded-2xl bg-black shadow-2xl">
                            <video
                                ref={videoRef}
                                className="w-full aspect-[9/16]"
                                controls
                                preload="metadata"
                                playsInline
                                poster=""
                            >
                                <source src={VIDEOS[activeVideo].src} type="video/mp4" />
                                Trình duyệt không hỗ trợ video.
                            </video>
                        </div>

                        {/* Video info card below */}
                        <div
                            className="mt-3 rounded-xl px-4 py-3 text-center"
                            style={{
                                background: "rgba(255,255,255,0.04)",
                                border: "1px solid rgba(255,255,255,0.06)",
                            }}
                        >
                            <p className="text-sm font-semibold text-white">{VIDEOS[activeVideo].title}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{VIDEOS[activeVideo].description}</p>
                            <div className="flex items-center justify-center gap-3 mt-2 text-[11px] text-slate-500">
                                <span className="flex items-center gap-1">
                                    <svg width="12" height="12" viewBox="0 0 20 20" fill="#10b981"><circle cx="10" cy="10" r="10" /><path d="M6 10l3 3 5-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
                                    Xác thực
                                </span>
                                <span>·</span>
                                <span>Học viên thực tế</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
