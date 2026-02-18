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

            <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 1440 60" preserveAspectRatio="none">
                <path fill="#ffffff" d="M0,40 C480,80 960,0 1440,40 L1440,60 L0,60 Z" />
            </svg>

        </section>
    );
}
