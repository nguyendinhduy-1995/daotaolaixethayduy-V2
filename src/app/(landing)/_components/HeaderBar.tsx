"use client";

import Link from "next/link";
import { HOTLINE, HOTLINE_TEL } from "./LandingStyles";

export default function HeaderBar() {
    return (
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-lg">
            <div className="mx-auto flex max-w-[1040px] items-center justify-between px-4 py-2">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-lg font-bold text-white shadow-sm">
                        🚗
                    </div>
                    <span className="hidden text-sm font-semibold text-slate-900 sm:block">
                        Đào Tạo Lái Xe Thầy Duy
                    </span>
                </Link>

                {/* Hotline */}
                <a
                    href={HOTLINE_TEL}
                    className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 transition hover:bg-amber-100"
                >
                    <span className="text-sm">📞</span>
                    <span className="flex flex-col leading-none">
                        <span className="text-xs font-bold text-slate-900">
                            <span className="hidden sm:inline">Hotline: </span>{HOTLINE}
                        </span>
                        <span className="text-[10px] text-amber-600">Gọi ngay</span>
                    </span>
                </a>

                {/* Auth buttons */}
                <div className="flex items-center gap-2">
                    <Link
                        href="/student/login"
                        className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.97]"
                    >
                        Đăng nhập
                    </Link>
                    <Link
                        href="/student/register"
                        className="rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-amber-600 active:scale-[0.97]"
                    >
                        Đăng ký
                    </Link>
                </div>
            </div>
        </header>
    );
}
