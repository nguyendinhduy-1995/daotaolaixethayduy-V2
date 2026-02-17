"use client";

import { useCallback, useEffect, useState } from "react";
import { RevealSection } from "./LandingStyles";
import Link from "next/link";

/* ── Auth Required Modal ── */
function AuthRequiredModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const backdropRef = useCallback((node: HTMLDivElement | null) => {
        if (node) node.focus();
    }, []);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", onKey);
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = "";
        };
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            ref={backdropRef}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm"
        >
            <div className="w-full max-w-sm rounded-2xl border border-slate-200/60 bg-white p-6 shadow-xl">
                <div className="text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-2xl">
                        🔒
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-slate-900">
                        Miniapp này dành cho học viên đã đăng ký
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500">
                        Vui lòng đăng nhập để sử dụng. Nếu chưa có tài khoản, hãy đăng ký để được hỗ trợ.
                    </p>
                </div>
                <div className="mt-5 flex gap-3">
                    <Link
                        href="/student/login"
                        className="flex h-11 flex-1 items-center justify-center rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.97]"
                    >
                        Đăng nhập
                    </Link>
                    <Link
                        href="/student/register"
                        className="flex h-11 flex-1 items-center justify-center rounded-xl bg-amber-500 text-sm font-bold text-white shadow-sm transition hover:bg-amber-600 active:scale-[0.97]"
                    >
                        Đăng ký
                    </Link>
                </div>
                <button
                    onClick={onClose}
                    className="mt-3 w-full py-2 text-xs text-slate-400 transition hover:text-slate-600"
                >
                    Đóng
                </button>
            </div>
        </div>
    );
}

/* ── App data ── */
type AppCard = {
    title: string;
    desc: string;
    icon: string;
    cta: string;
    isPublic: boolean;
    href?: string;
};

const CONG_CU: AppCard[] = [
    {
        title: "Tập Lái Lý Thuyết",
        desc: "600 câu hỏi lý thuyết mới nhất",
        icon: "📝",
        cta: "MỞ ỨNG DỤNG",
        isPublic: true,
        href: "https://taplai.thayduydaotaolaixe.com",
    },
    {
        title: "Mô Phỏng Tình Huống",
        desc: "120 tình huống giao thông mô phỏng",
        icon: "🖥️",
        cta: "MỞ ỨNG DỤNG",
        isPublic: true,
        href: "https://taplai.thayduydaotaolaixe.com",
    },
    {
        title: "Lịch Học",
        desc: "Xem lịch học và lịch thi của bạn",
        icon: "📅",
        cta: "Cần đăng nhập",
        isPublic: false,
    },
    {
        title: "Danh Sách Ngày Thi",
        desc: "Chuẩn bị đầy đủ cho ngày thi sát hạch",
        icon: "✅",
        cta: "Cần đăng nhập",
        isPublic: false,
    },
];

/* ── Component ── */
export default function ToolsHub() {
    const [modalOpen, setModalOpen] = useState(false);
    const closeModal = useCallback(() => setModalOpen(false), []);

    function handleCardClick(app: AppCard) {
        if (app.isPublic && app.href) {
            window.open(app.href, "_blank", "noopener,noreferrer");
        } else {
            setModalOpen(true);
        }
    }

    return (
        <>
            <section className="mx-auto max-w-[1040px] px-4 py-10 md:py-14">
                <RevealSection>
                    {(visible) => (
                        <div className={visible ? "ld-fade-up" : "opacity-0"}>
                            <h2 className="text-center text-lg font-semibold text-slate-900 md:text-xl">
                                Công Cụ Hỗ Trợ Học Viên
                            </h2>
                            <p className="mt-1 text-center text-sm text-slate-500">
                                Các ứng dụng giúp bạn học hiệu quả hơn
                            </p>

                            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                                {CONG_CU.map((app, idx) => (
                                    <div
                                        key={app.title}
                                        className={`group relative flex flex-col items-center rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1 ${visible ? `ld-scale-in ld-d${idx + 1}` : "opacity-0"}`}
                                    >
                                        <span
                                            className={`absolute -top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide shadow-sm ${app.isPublic
                                                ? "bg-emerald-500 text-white"
                                                : "bg-slate-600 text-white"
                                                }`}
                                        >
                                            {app.isPublic ? "Miễn phí" : "Cần đăng nhập"}
                                        </span>

                                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl transition-transform duration-300 group-hover:scale-110">
                                            {app.icon}
                                        </div>
                                        <h3 className="mt-3 text-center text-xs font-semibold text-slate-900 leading-tight md:text-sm">
                                            {app.title}
                                        </h3>
                                        <p className="mt-1 text-center text-[10px] text-slate-500 leading-snug md:text-xs">
                                            {app.desc}
                                        </p>
                                        <button
                                            onClick={() => handleCardClick(app)}
                                            className={`mt-3 w-full rounded-lg px-3 py-2 text-xs font-bold transition-all duration-200 active:scale-[0.97] ${app.isPublic
                                                ? "bg-amber-500 text-white hover:bg-amber-600"
                                                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                                                }`}
                                        >
                                            {app.cta}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </RevealSection>
            </section>

            <AuthRequiredModal open={modalOpen} onClose={closeModal} />
        </>
    );
}
