"use client";

import Link from "next/link";
import { HOTLINE, HOTLINE_TEL } from "./LandingStyles";

const ZALO_LINK = "https://zalo.me/0948742666";

export default function HeaderBar() {
    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100">
            <div className="mx-auto flex max-w-[1040px] items-center justify-between px-4 h-12">
                {/* Brand name — clean text only */}
                <Link href="/" className="text-sm font-bold text-slate-900 tracking-tight">
                    Thầy Duy <span className="hidden sm:inline text-slate-400 font-normal">| Đào Tạo Lái Xe</span>
                </Link>

                {/* Right side */}
                <div className="flex items-center gap-2">
                    {/* Hotline — compact pill */}
                    <a
                        href={HOTLINE_TEL}
                        className="flex items-center gap-1.5 rounded-full bg-slate-50 border border-slate-200/60 px-3 py-1.5 transition hover:bg-slate-100"
                    >
                        <span className="text-xs">📞</span>
                        <span className="text-xs font-semibold text-slate-700">{HOTLINE}</span>
                    </a>

                    {/* Đăng nhập */}
                    <Link
                        href="/student/login"
                        className="hidden sm:inline-flex rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                    >
                        Đăng nhập
                    </Link>

                    {/* Liên hệ Zalo */}
                    <a
                        href={ZALO_LINK}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 active:scale-[0.97]"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0">
                            <path d="M12 0C5.373 0 0 4.925 0 11c0 3.178 1.501 6.016 3.875 7.93V24l4.802-2.64A12.52 12.52 0 0012 22c6.627 0 12-4.925 12-11S18.627 0 12 0z" />
                        </svg>
                        Zalo
                    </a>
                </div>
            </div>
        </header>
    );
}
