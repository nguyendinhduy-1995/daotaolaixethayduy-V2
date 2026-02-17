"use client";

import { useState } from "react";
import { RevealSection } from "./LandingStyles";

export default function PackageIncludes() {
    const [openA, setOpenA] = useState(true);
    const [openB, setOpenB] = useState(false);

    return (
        <section className="mx-auto max-w-[1040px] px-4 pb-10 md:pb-14">
            <RevealSection>
                {(visible) => (
                    <div className={visible ? "ld-fade-up" : "opacity-0"}>
                        <h2 className="text-center text-lg font-semibold text-slate-900 md:text-xl">
                            Trọn gói gồm gì?
                        </h2>
                        <p className="mt-1 text-center text-sm text-slate-500">
                            Minh bạch chi phí – không phát sinh ngoài ý muốn
                        </p>

                        <div className="mt-6 space-y-3">
                            {/* Card A – Đã bao gồm */}
                            <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
                                <button
                                    onClick={() => setOpenA(!openA)}
                                    className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-slate-50"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-sm">✅</span>
                                        <span className="text-sm font-semibold text-slate-900">Đã bao gồm trong trọn gói</span>
                                    </div>
                                    <span className={`text-slate-400 transition-transform ${openA ? "rotate-180" : ""}`}>▼</span>
                                </button>
                                {openA && (
                                    <div className="border-t border-slate-100 px-5 py-4">
                                        <ul className="space-y-2.5 text-sm text-slate-600">
                                            {[
                                                "Tài liệu học, đồng phục, thẻ học viên",
                                                "Học lý thuyết & mô phỏng",
                                                "Học thực hành trong sa hình",
                                                "Cabin mô phỏng",
                                                "Chạy DAT",
                                            ].map((item) => (
                                                <li key={item} className="flex items-start gap-2">
                                                    <span className="mt-0.5 text-emerald-500">✓</span>
                                                    <span>{item}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            {/* Card B – Phát sinh */}
                            <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
                                <button
                                    onClick={() => setOpenB(!openB)}
                                    className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-slate-50"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-sm">💡</span>
                                        <span className="text-sm font-semibold text-slate-900">Phát sinh bắt buộc (theo quy định)</span>
                                    </div>
                                    <span className={`text-slate-400 transition-transform ${openB ? "rotate-180" : ""}`}>▼</span>
                                </button>
                                {openB && (
                                    <div className="border-t border-slate-100 px-5 py-4">
                                        <ul className="space-y-2.5 text-sm text-slate-600">
                                            <li className="flex items-start justify-between">
                                                <span>Phí khám sức khỏe</span>
                                                <span className="font-bold text-amber-600">250.000₫</span>
                                            </li>
                                            <li className="flex items-start justify-between">
                                                <span>Lệ phí thi</span>
                                                <span className="font-bold text-amber-600">930.000₫</span>
                                            </li>
                                        </ul>
                                        <div className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 p-3">
                                            <span className="mt-0.5 text-sm text-slate-400">ℹ️</span>
                                            <p className="text-xs leading-relaxed text-slate-500">
                                                Các khoản phát sinh này thu theo quy định/đơn vị liên quan.
                                                Bên Thầy Duy sẽ nhắc và hướng dẫn đúng thời điểm.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </RevealSection>
        </section>
    );
}
