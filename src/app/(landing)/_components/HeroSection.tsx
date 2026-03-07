"use client";

import { useState, useEffect, useCallback } from "react";

interface Props {
    scrollTo: (id: string) => void;
}

const HERO_MESSAGES = [
    "Nhanh nhưng không ẩu — lộ trình rút gọn, bám chuẩn theo quy định.",
    "Học đúng trọng tâm, luyện đúng lỗi hay rớt — tiết kiệm thời gian, tăng tỉ lệ đậu.",
    "Lịch học linh hoạt, theo tiến độ cá nhân — vẫn đảm bảo đủ nội dung bắt buộc.",
    "Quy trình rõ ràng từ hồ sơ → học → thi — minh bạch từng bước, không mập mờ.",
    "Giảng dạy thực chiến: tập trung sa hình, mô phỏng, tình huống thường gặp khi thi.",
    "Cam kết \"đúng chuẩn đào tạo\" — ưu tiên an toàn và kỹ năng thật sau khi có bằng.",
];

const TYPING_SPEED = 35;
const ERASING_SPEED = 18;
const PAUSE_AFTER_TYPING = 2500;
const PAUSE_AFTER_ERASING = 400;

function useTypewriter(messages: string[]) {
    const [msgIndex, setMsgIndex] = useState(0);
    const [displayed, setDisplayed] = useState("");
    const [isTyping, setIsTyping] = useState(true);

    const currentMsg = messages[msgIndex];

    const tick = useCallback(() => {
        if (isTyping) {
            if (displayed.length < currentMsg.length) {
                setDisplayed(currentMsg.slice(0, displayed.length + 1));
            }
        } else {
            if (displayed.length > 0) {
                setDisplayed(currentMsg.slice(0, displayed.length - 1));
            }
        }
    }, [isTyping, displayed, currentMsg]);

    useEffect(() => {
        // Finished typing
        if (isTyping && displayed.length === currentMsg.length) {
            const timer = setTimeout(() => setIsTyping(false), PAUSE_AFTER_TYPING);
            return () => clearTimeout(timer);
        }
        // Finished erasing
        if (!isTyping && displayed.length === 0) {
            const timer = setTimeout(() => {
                setMsgIndex((prev) => (prev + 1) % messages.length);
                setIsTyping(true);
            }, PAUSE_AFTER_ERASING);
            return () => clearTimeout(timer);
        }
        // Tick
        const speed = isTyping ? TYPING_SPEED : ERASING_SPEED;
        const timer = setTimeout(tick, speed);
        return () => clearTimeout(timer);
    }, [displayed, isTyping, currentMsg, tick, messages.length]);

    return displayed;
}

export default function HeroSection({ scrollTo }: Props) {
    const typedText = useTypewriter(HERO_MESSAGES);

    return (
        <section
            className="relative overflow-hidden"
            style={{
                background: "linear-gradient(135deg, #FFF8E7 0%, #FFF3CD 50%, #FFEAA0 100%)",
            }}
        >
            {/* ── Driving Car Animation CSS ── */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes drive-car {
                    0% { transform: translateX(-220px); }
                    100% { transform: translateX(calc(100vw + 50px)); }
                }
                @keyframes car-bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-2px); }
                }
                @keyframes wheel-spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                @keyframes dust-puff {
                    0% { opacity: 0.6; transform: scale(0.5) translateX(0); }
                    60% { opacity: 0.3; }
                    100% { opacity: 0; transform: scale(2) translateX(-30px); }
                }
                @keyframes road-dash {
                    0% { stroke-dashoffset: 0; }
                    100% { stroke-dashoffset: -40; }
                }
                .hero-car-wrapper {
                    animation: drive-car 12s linear infinite;
                }
                .hero-car-body {
                    animation: car-bounce 0.4s ease-in-out infinite;
                }
                .hero-wheel {
                    animation: wheel-spin 0.6s linear infinite;
                }
                .hero-dust {
                    animation: dust-puff 0.8s ease-out infinite;
                }
                .hero-dust:nth-child(2) { animation-delay: 0.25s; }
                .hero-dust:nth-child(3) { animation-delay: 0.5s; }
                .hero-road-dash {
                    animation: road-dash 0.8s linear infinite;
                }
            `}} />

            <div className="mx-auto max-w-[1040px] px-4 py-12 md:py-20">
                <h1 className="ld-fade-up text-[28px] font-semibold leading-[1.12] tracking-tight text-slate-900 md:text-[34px]">
                    Học lái xe nhanh –<br />
                    <span className="text-amber-600">Đúng quy trình</span>
                </h1>

                <div className="ld-fade-up ld-d1 mt-4 h-[60px] max-w-2xl md:h-[48px]">
                    <p className="text-sm leading-relaxed text-slate-700 md:text-base">
                        <span>{typedText}</span>
                        <span
                            className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[2px] bg-amber-500"
                            style={{
                                animation: "blink-cursor 0.75s step-end infinite",
                            }}
                        />
                    </p>
                </div>

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

            {/* ── Road + Driving Car ── */}
            <div className="absolute bottom-[18px] left-0 w-full pointer-events-none" style={{ zIndex: 2 }}>
                {/* Road surface */}
                <svg className="absolute bottom-0 left-0 w-full" height="28" preserveAspectRatio="none" viewBox="0 0 1440 28">
                    <rect y="0" width="1440" height="28" fill="#4a4a4a" rx="2" />
                    <line x1="0" y1="14" x2="1440" y2="14"
                        stroke="#e2e2a0" strokeWidth="2" strokeDasharray="20 20"
                        className="hero-road-dash" />
                </svg>

                {/* Animated car */}
                <div className="hero-car-wrapper" style={{ position: "absolute", bottom: "14px" }}>
                    <div className="hero-car-body" style={{ position: "relative" }}>
                        {/* Dust particles behind car */}
                        <div style={{ position: "absolute", right: "160px", bottom: "2px" }}>
                            <div className="hero-dust" style={{ position: "absolute", width: 8, height: 8, borderRadius: "50%", background: "rgba(180,160,120,0.5)", right: 0, bottom: 0 }} />
                            <div className="hero-dust" style={{ position: "absolute", width: 6, height: 6, borderRadius: "50%", background: "rgba(180,160,120,0.4)", right: 8, bottom: 4 }} />
                            <div className="hero-dust" style={{ position: "absolute", width: 10, height: 10, borderRadius: "50%", background: "rgba(180,160,120,0.3)", right: -4, bottom: -2 }} />
                        </div>

                        {/* Car SVG */}
                        <svg width="200" height="80" viewBox="0 0 200 80" fill="none">
                            {/* Car body */}
                            <rect x="20" y="30" width="160" height="32" rx="6" fill="#FFFFFF" stroke="#cbd5e1" strokeWidth="1.5" />
                            {/* Cabin/windows */}
                            <path d="M55 30 L70 12 L130 12 L145 30" fill="#bfdbfe" stroke="#94a3b8" strokeWidth="1" />
                            <line x1="100" y1="12" x2="100" y2="30" stroke="#94a3b8" strokeWidth="1" />
                            {/* Roof sign: TẬP LÁI */}
                            <rect x="75" y="2" width="50" height="12" rx="3" fill="#f59e0b" />
                            <text x="100" y="11" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="700" fontFamily="sans-serif">TẬP LÁI</text>
                            {/* Headlight */}
                            <rect x="174" y="38" width="8" height="6" rx="2" fill="#fef08a" />
                            {/* Tail light */}
                            <rect x="18" y="38" width="6" height="6" rx="2" fill="#ef4444" />
                            {/* Front wheel */}
                            <g transform="translate(145, 62)">
                                <circle r="12" fill="#374151" />
                                <circle r="8" fill="#6b7280" />
                                <circle r="3" fill="#374151" />
                                <line x1="-6" y1="0" x2="6" y2="0" stroke="#9ca3af" strokeWidth="1" className="hero-wheel" style={{ transformOrigin: "0 0" }} />
                            </g>
                            {/* Rear wheel */}
                            <g transform="translate(55, 62)">
                                <circle r="12" fill="#374151" />
                                <circle r="8" fill="#6b7280" />
                                <circle r="3" fill="#374151" />
                                <line x1="-6" y1="0" x2="6" y2="0" stroke="#9ca3af" strokeWidth="1" className="hero-wheel" style={{ transformOrigin: "0 0" }} />
                            </g>
                        </svg>
                    </div>
                </div>
            </div>

            <svg className="absolute bottom-0 left-0 w-full" style={{ zIndex: 3 }} viewBox="0 0 1440 60" preserveAspectRatio="none">
                <path fill="#ffffff" d="M0,40 C480,80 960,0 1440,40 L1440,60 L0,60 Z" />
            </svg>

        </section>
    );
}
