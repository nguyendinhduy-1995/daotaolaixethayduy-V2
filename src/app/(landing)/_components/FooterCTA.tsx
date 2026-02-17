"use client";

import { HOTLINE_TEL } from "./LandingStyles";

interface Props {
    scrollTo: (id: string) => void;
}

export default function FooterCTA({ scrollTo }: Props) {
    return (
        <section className="bg-slate-900 py-10 md:py-14">
            <div className="mx-auto max-w-[1040px] px-4 text-center">
                <h2 className="text-lg font-semibold text-white md:text-xl">
                    Bắt đầu hành trình lái xe cùng Thầy Duy
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                    Đăng ký ngay hoặc gọi hotline để được tư vấn miễn phí
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <button
                        onClick={() => scrollTo("dang-ky")}
                        className="rounded-xl bg-amber-500 px-6 py-3 text-sm font-bold text-white shadow-md shadow-amber-500/20 transition hover:bg-amber-600 active:scale-[0.97]"
                    >
                        Đăng ký ngay
                    </button>
                    <a
                        href={HOTLINE_TEL}
                        className="rounded-xl border border-slate-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-[0.97]"
                    >
                        📞 Gọi hotline
                    </a>
                </div>
            </div>
        </section>
    );
}
