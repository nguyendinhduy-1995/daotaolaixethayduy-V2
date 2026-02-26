"use client";

import { useEffect, useState } from "react";

const ZALO_GROUP_URL = "https://zalo.me/g/mmskdh050";
const DISMISS_KEY = "zalo_group_popup_dismissed";
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export function ZaloGroupPopup() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Check if user dismissed recently
        const dismissed = localStorage.getItem(DISMISS_KEY);
        if (dismissed) {
            const dismissedAt = parseInt(dismissed, 10);
            if (Date.now() - dismissedAt < DISMISS_DURATION_MS) return;
        }

        // Show after 2 seconds
        const timer = setTimeout(() => setVisible(true), 2000);
        return () => clearTimeout(timer);
    }, []);

    function dismiss() {
        setVisible(false);
        localStorage.setItem(DISMISS_KEY, Date.now().toString());
    }

    if (!visible) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm animate-fadeIn"
                onClick={dismiss}
            />

            {/* Popup */}
            <div className="fixed inset-x-4 top-1/2 z-[101] mx-auto max-w-sm -translate-y-1/2 animate-scaleIn">
                <div className="overflow-hidden rounded-3xl bg-white shadow-2xl shadow-black/20">
                    {/* Header gradient */}
                    <div className="relative bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 px-5 py-6 text-center text-white">
                        {/* Close button */}
                        <button
                            type="button"
                            onClick={dismiss}
                            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white/90 transition hover:bg-white/30 active:scale-90"
                            aria-label="Đóng"
                        >
                            ✕
                        </button>

                        {/* Zalo icon */}
                        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 text-3xl backdrop-blur-sm shadow-lg">
                            💬
                        </div>
                        <h2 className="text-lg font-bold leading-tight">
                            Tham gia Group Lý Thuyết
                        </h2>
                        <p className="mt-1 text-sm text-white/80">cùng Thầy Duy</p>
                    </div>

                    {/* Body */}
                    <div className="px-5 py-5">
                        <p className="mb-4 text-center text-sm leading-relaxed text-zinc-600">
                            🎓 Cùng nhau học lý thuyết, chia sẻ kinh nghiệm và hỏi đáp.
                            <br />
                            <span className="text-xs text-zinc-400">
                                Hỗ trợ 24/7 — Hoàn toàn miễn phí
                            </span>
                        </p>

                        {/* CTA Button */}
                        <a
                            href={ZALO_GROUP_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={dismiss}
                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-blue-200 transition-all hover:shadow-xl hover:shadow-blue-300 active:scale-[0.97]"
                        >
                            <span className="text-xl">💬</span>
                            Tham gia ngay
                        </a>

                        {/* Dismiss link */}
                        <button
                            type="button"
                            onClick={dismiss}
                            className="mt-3 block w-full text-center text-xs text-zinc-400 transition hover:text-zinc-600"
                        >
                            Để sau
                        </button>
                    </div>
                </div>
            </div>

            <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        .animate-scaleIn { 
          left: 50%;
          transform: translate(-50%, -50%);
          animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); 
        }
      `}</style>
        </>
    );
}
