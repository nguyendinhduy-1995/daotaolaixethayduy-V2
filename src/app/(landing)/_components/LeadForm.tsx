"use client";

import { FormEvent, useState } from "react";
import { RevealSection, HOTLINE, HOTLINE_TEL, PROVINCES, LICENSE_TYPES } from "./LandingStyles";

export default function LeadForm() {
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [province, setProvince] = useState("TPHCM");
    const [licenseType, setLicenseType] = useState("B2");
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/public/lead", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fullName, phone, province, licenseType }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                setError(data?.error?.message || "Gửi thất bại. Vui lòng thử lại.");
                return;
            }
            setSubmitted(true);
        } catch {
            setError("Lỗi kết nối. Vui lòng thử lại.");
        } finally {
            setLoading(false);
        }
    }

    const inputCls =
        "h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30";

    return (
        <section className="mx-auto max-w-[1040px] px-4 py-10 md:py-14">
            <RevealSection>
                {(visible) => (
                    <div className={visible ? "ld-fade-up" : "opacity-0"}>
                        <h2 className="text-center text-lg font-semibold text-slate-900 md:text-xl">
                            Đăng Ký Tư Vấn Miễn Phí
                        </h2>
                        <p className="mt-1 text-center text-sm text-slate-500">
                            Để lại thông tin, Thầy Duy liên hệ tư vấn trong 15 phút
                        </p>

                        <div className="mx-auto mt-6 max-w-md">
                            {submitted ? (
                                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center shadow-sm">
                                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-2xl">
                                        ✅
                                    </div>
                                    <h3 className="mt-3 text-base font-semibold text-slate-900">
                                        Đã gửi thành công!
                                    </h3>
                                    <p className="mt-1 text-sm text-slate-500">
                                        Thầy Duy sẽ liên hệ bạn trong thời gian sớm nhất.
                                    </p>
                                    <a
                                        href={HOTLINE_TEL}
                                        className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-amber-600"
                                    >
                                        📞 Gọi ngay: {HOTLINE}
                                    </a>
                                </div>
                            ) : (
                                <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
                                    {error && (
                                        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                            ⚠️ {error}
                                        </div>
                                    )}
                                    <form className="space-y-3" onSubmit={onSubmit}>
                                        <div>
                                            <label className="mb-1 block text-xs font-medium text-slate-600">Họ và tên</label>
                                            <input
                                                type="text"
                                                value={fullName}
                                                onChange={(e) => setFullName(e.target.value)}
                                                placeholder="Nguyễn Văn A"
                                                required
                                                className={inputCls}
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-xs font-medium text-slate-600">Số điện thoại</label>
                                            <input
                                                type="tel"
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value)}
                                                placeholder="0948 742 666"
                                                required
                                                className={inputCls}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="mb-1 block text-xs font-medium text-slate-600">Tỉnh / Thành</label>
                                                <select
                                                    value={province}
                                                    onChange={(e) => setProvince(e.target.value)}
                                                    className={inputCls}
                                                >
                                                    {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="mb-1 block text-xs font-medium text-slate-600">Hạng bằng</label>
                                                <select
                                                    value={licenseType}
                                                    onChange={(e) => setLicenseType(e.target.value)}
                                                    className={inputCls}
                                                >
                                                    {LICENSE_TYPES.map((l) => <option key={l} value={l}>{l}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        {/* Honeypot anti-spam */}
                                        <input type="text" name="_hp" className="hidden" tabIndex={-1} autoComplete="off" />
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="ld-pulse h-12 w-full rounded-xl bg-amber-500 text-sm font-bold text-white shadow-md shadow-amber-500/20 transition-all hover:bg-amber-600 disabled:opacity-60 active:scale-[0.97]"
                                        >
                                            {loading ? "Đang gửi..." : "GỬI ĐĂNG KÝ"}
                                        </button>
                                    </form>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </RevealSection>
        </section>
    );
}
