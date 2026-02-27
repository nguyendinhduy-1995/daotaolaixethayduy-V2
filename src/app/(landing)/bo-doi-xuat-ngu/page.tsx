"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { HOTLINE, HOTLINE_TEL, PROVINCES, ANIM_CSS, RevealSection } from "../_components/LandingStyles";
import { trackMetaEvent } from "@/lib/meta-pixel";

/* ── Validation helpers (reused from LeadForm logic) ── */
function normalizePhone(raw: string): string {
    const stripped = raw.replace(/[\s\-().]+/g, "");
    if (stripped.startsWith("+84")) return "0" + stripped.slice(3);
    return stripped;
}
function isValidPhone(raw: string): boolean {
    return /^0\d{8,10}$/.test(normalizePhone(raw));
}
function isValidName(name: string): boolean {
    return name.trim().length >= 2;
}
function idempotencyKey(phone: string): string {
    const d = new Date().toISOString().slice(0, 10);
    return `lead_bdxn_${normalizePhone(phone)}_${d}`;
}
function trackSiteEvent(eventType: string, extra?: Record<string, unknown>) {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window as any;
        if (typeof w?.__trackEvent === "function") w.__trackEvent(eventType, extra);
    } catch { /* ignore */ }
}

/* ── License types for veterans ── */
const VETERAN_LICENSE_TYPES = [
    { value: "B", label: "Hạng B — Ô tô dưới 9 chỗ", price: "MIỄN PHÍ 100%" },
    { value: "C1", label: "Hạng C1 — Xe tải nhẹ", price: "MIỄN PHÍ 100%" },
];

/* ── Benefits data ── */
const BENEFITS = [
    { icon: "💰", title: "Miễn phí 100%", desc: "Hoàn toàn miễn phí học phí cho bộ đội xuất ngũ" },
    { icon: "📅", title: "Lịch học linh hoạt", desc: "Sắp xếp theo lịch cá nhân, phù hợp với anh em" },
    { icon: "📋", title: "Hỗ trợ hồ sơ", desc: "Hướng dẫn và hỗ trợ hoàn thiện hồ sơ từ A-Z" },
    { icon: "🚗", title: "Thực hành thực tế", desc: "Luyện sa hình, mô phỏng, kỹ năng lái thật" },
    { icon: "🤝", title: "Đồng hành tận tâm", desc: "Thầy Duy trực tiếp hỗ trợ, tư vấn 24/7" },
];

export default function VeteranLandingPage() {
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [province] = useState("Vĩnh Long");
    const [licenseType, setLicenseType] = useState("");
    const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [landingEnabled, setLandingEnabled] = useState<boolean | null>(null);
    const firedEvents = useRef({ start: false, complete: false, submitted: new Set<string>() });
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const formRef = useRef<HTMLDivElement>(null);

    // Check if landing is enabled
    useEffect(() => {
        fetch("/api/public/landing-status?key=bo-doi-xuat-ngu")
            .then((r) => r.json())
            .then((d) => setLandingEnabled(d.enabled !== false))
            .catch(() => setLandingEnabled(true));
    }, []);

    function onFirstFocus() {
        if (!firedEvents.current.start) {
            firedEvents.current.start = true;
            trackSiteEvent("veteran_lead_form_start");
        }
    }

    const doSubmit = useCallback(async (name: string, ph: string, prov: string, lt: string) => {
        const normPhone = normalizePhone(ph);
        const key = idempotencyKey(normPhone);
        if (firedEvents.current.submitted.has(key)) return;
        if (isSubmitting) return;

        setIsSubmitting(true);
        setStatus("submitting");
        setErrorMsg("");

        try {
            const res = await fetch("/api/public/lead", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fullName: name.trim(),
                    phone: normPhone,
                    province: prov,
                    licenseType: lt,
                    source: "bo-doi-xuat-ngu",
                    tags: ["BDXN"],
                }),
            });

            const data = await res.json().catch(() => null);
            if (!res.ok) {
                const msg = data?.error?.message || `Gửi thất bại (${res.status}). Vui lòng thử lại.`;
                setStatus("error");
                setErrorMsg(msg);
                trackSiteEvent("veteran_lead_submit_fail", { error: msg });
                return;
            }

            firedEvents.current.submitted.add(key);
            setStatus("success");
            trackSiteEvent("veteran_lead_submit_success", { phone: normPhone });
            trackMetaEvent("Lead", { content_name: "VeteranLandingForm", content_category: lt }, { phone: normPhone });
            trackMetaEvent("CompleteRegistration", { content_name: "VeteranLandingForm", status: "success" }, { phone: normPhone });

            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const w = window as any;
                if (typeof w?.gtag === "function") {
                    w.gtag("event", "generate_lead", { currency: "VND", value: 1, campaign: "bo-doi-xuat-ngu" });
                }
            } catch { /* ignore */ }
        } catch {
            setStatus("error");
            setErrorMsg("Lỗi kết nối. Bấm GỬI để thử lại.");
            trackSiteEvent("veteran_lead_submit_fail", { error: "network" });
        } finally {
            setIsSubmitting(false);
        }
    }, [isSubmitting]);

    const tryAutoSubmit = useCallback(() => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        if (!isValidName(fullName) || !isValidPhone(phone) || !province || !licenseType) return;
        if (!firedEvents.current.complete) {
            firedEvents.current.complete = true;
            trackSiteEvent("veteran_lead_form_complete", { phone: normalizePhone(phone) });
        }
        debounceTimer.current = setTimeout(() => {
            doSubmit(fullName, phone, province, licenseType);
        }, 800);
    }, [doSubmit, fullName, phone, province, licenseType]);

    useEffect(() => {
        if (status === "success") return;
        tryAutoSubmit();
        return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
    }, [province, licenseType, tryAutoSubmit, status]);

    function onManualSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (status === "success") return;
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        if (!isValidName(fullName)) { setStatus("error"); setErrorMsg("Vui lòng nhập họ và tên."); return; }
        if (!isValidPhone(phone)) { setStatus("error"); setErrorMsg("Số điện thoại không hợp lệ. Vui lòng nhập 10 số bắt đầu bằng 0."); return; }

        if (!licenseType) { setStatus("error"); setErrorMsg("Vui lòng chọn hạng bằng."); return; }
        doSubmit(fullName, phone, province, licenseType);
    }

    function scrollToForm() {
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    const phoneValid = isValidPhone(phone);
    const nameValid = isValidName(fullName);

    const inputCls =
        "h-12 w-full rounded-xl border border-emerald-700/30 bg-emerald-950/50 px-4 text-sm text-emerald-50 placeholder:text-emerald-400/50 transition-all focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30 backdrop-blur";

    // Loading state while checking
    if (landingEnabled === null) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-emerald-950">
                <div className="flex items-center gap-3 text-emerald-300">
                    <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                    <span className="text-sm">Đang tải...</span>
                </div>
            </div>
        );
    }

    // Landing disabled by admin
    if (!landingEnabled) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-emerald-950 px-4">
                <div className="max-w-md rounded-2xl border border-emerald-700/40 bg-emerald-900/40 p-8 text-center backdrop-blur-sm">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/20 text-4xl">🪖</div>
                    <h1 className="mt-4 text-xl font-bold text-emerald-50">Chương trình tạm ngưng</h1>
                    <p className="mt-2 text-sm text-emerald-300/70">
                        Chương trình ưu đãi cho bộ đội xuất ngũ hiện đang tạm ngưng. Vui lòng quay lại sau hoặc liên hệ hotline để biết thêm chi tiết.
                    </p>
                    <a
                        href={HOTLINE_TEL}
                        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-amber-400"
                    >
                        📞 Gọi ngay: {HOTLINE}
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-emerald-950 text-white">
            <style dangerouslySetInnerHTML={{
                __html: ANIM_CSS + `
                @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
                @keyframes shine { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
                @keyframes badge-glow { 0%,100% { box-shadow: 0 0 20px rgba(251,191,36,.3); } 50% { box-shadow: 0 0 40px rgba(251,191,36,.6); } }
                .float { animation: float 3s ease-in-out infinite; }
                .shine-text { background: linear-gradient(90deg, #fbbf24, #fde68a, #fbbf24); background-size: 200% auto; -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: shine 3s linear infinite; }
                .badge-glow { animation: badge-glow 2s ease-in-out infinite; }
                @keyframes star-float-1 { 0%,100% { transform: translate(0,0) rotate(0deg); opacity:.3; } 50% { transform: translate(10px,-15px) rotate(180deg); opacity:.6; } }
                @keyframes star-float-2 { 0%,100% { transform: translate(0,0) rotate(0deg); opacity:.2; } 50% { transform: translate(-12px,-10px) rotate(-180deg); opacity:.5; } }
                .star-1 { animation: star-float-1 4s ease-in-out infinite; }
                .star-2 { animation: star-float-2 5s ease-in-out infinite; }
            ` }} />

            {/* ═══════ HEADER ═══════ */}
            <header className="fixed top-0 left-0 right-0 z-50 border-b border-emerald-800/60 bg-emerald-950/80 shadow-lg backdrop-blur-xl">
                <div className="mx-auto flex max-w-[1040px] items-center justify-between px-3 sm:px-4 py-2">

                    {/* Learning buttons */}
                    <div className="flex items-center gap-1.5">
                        <a
                            href="https://taplai.thayduydaotaolaixe.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-emerald-600/50 bg-emerald-800/40 px-2 sm:px-3 py-1.5 text-[10px] sm:text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-700/50 active:scale-[0.97]"
                        >
                            📖 Lý thuyết
                        </a>
                        <a
                            href="https://mophong.thayduydaotaolaixe.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-emerald-600/50 bg-emerald-800/40 px-2 sm:px-3 py-1.5 text-[10px] sm:text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-700/50 active:scale-[0.97]"
                        >
                            🖥️ Mô phỏng
                        </a>
                    </div>

                    <a
                        href={HOTLINE_TEL}
                        className="flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 sm:px-3 py-1.5 transition hover:bg-amber-500/20"
                    >
                        <span className="text-sm">📞</span>
                        <span className="flex flex-col leading-none">
                            <span className="text-[11px] sm:text-xs font-bold text-amber-300">
                                <span className="hidden sm:inline">Hotline: </span>{HOTLINE}
                            </span>
                            <span className="text-[9px] sm:text-[10px] text-amber-400/70">Gọi ngay</span>
                        </span>
                    </a>
                </div>
            </header>

            {/* ═══════ HERO ═══════ */}
            <section className="relative overflow-hidden pt-[44px] sm:pt-[52px]">
                <div
                    className="absolute inset-0"
                    style={{
                        background: "linear-gradient(135deg, #064e3b 0%, #022c22 40%, #14532d 70%, #052e16 100%)",
                    }}
                />
                {/* Decorative stars */}
                <div className="absolute top-20 left-[10%] text-4xl star-1 pointer-events-none select-none">⭐</div>
                <div className="absolute top-32 right-[15%] text-3xl star-2 pointer-events-none select-none">🎖️</div>
                <div className="absolute bottom-20 left-[20%] text-2xl star-2 pointer-events-none select-none">⭐</div>
                <div className="absolute bottom-10 right-[10%] text-3xl star-1 pointer-events-none select-none">🪖</div>

                <div className="relative mx-auto max-w-[1040px] px-3 sm:px-4 py-10 sm:py-14 md:py-24 text-center">
                    {/* Badge */}
                    <div className="ld-fade-up inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 sm:px-4 py-1 sm:py-1.5 badge-glow mb-4 sm:mb-6">
                        <span className="text-base sm:text-lg">🎖️</span>
                        <span className="text-[10px] sm:text-xs font-bold tracking-wider text-amber-300 uppercase">Ưu đãi bộ đội xuất ngũ</span>
                    </div>

                    <h1 className="ld-fade-up ld-d1 text-[26px] sm:text-[32px] md:text-[46px] font-bold leading-tight tracking-tight">
                        Miễn Phí{" "}
                        <span className="shine-text text-[30px] sm:text-[36px] md:text-[52px]">100%</span>
                        <br />
                        <span className="text-emerald-300">Học Phí Lái Xe</span>
                    </h1>

                    <p className="ld-fade-up ld-d2 mt-3 sm:mt-4 text-sm sm:text-base md:text-lg text-emerald-200/80 max-w-xl mx-auto px-2">
                        Tri ân anh em bộ đội xuất ngũ — Đăng ký học lái xe <strong className="text-amber-300">hạng B</strong> hoặc <strong className="text-amber-300">hạng C1</strong> hoàn toàn miễn phí tại Thầy Duy.
                    </p>

                    {/* License cards */}
                    <div className="ld-fade-up ld-d3 mt-5 sm:mt-8 flex flex-wrap justify-center gap-2.5 sm:gap-4">
                        {VETERAN_LICENSE_TYPES.map((lt) => (
                            <div
                                key={lt.value}
                                className="relative overflow-hidden rounded-xl sm:rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/15 to-emerald-800/30 px-4 sm:px-6 py-3 sm:py-4 backdrop-blur-sm transition hover:border-amber-400/50 hover:scale-[1.02] flex-1 min-w-[140px] max-w-[220px]"
                            >
                                <div className="text-xs sm:text-sm font-semibold text-emerald-100">{lt.label}</div>
                                <div className="mt-0.5 sm:mt-1 text-base sm:text-lg font-black text-amber-400">{lt.price}</div>
                            </div>
                        ))}
                    </div>

                    <div className="ld-fade-up ld-d4 mt-5 sm:mt-8 flex flex-wrap justify-center gap-2.5 sm:gap-3">
                        <button
                            onClick={scrollToForm}
                            className="ld-pulse inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 sm:px-7 py-3 sm:py-3.5 text-sm font-bold text-white shadow-lg shadow-amber-500/30 transition hover:bg-amber-400 active:scale-[0.97]"
                        >
                            🪖 ĐĂNG KÝ NGAY
                        </button>
                        <a
                            href={HOTLINE_TEL}
                            className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-800/30 px-5 sm:px-6 py-3 sm:py-3.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-800/50 active:scale-[0.97]"
                        >
                            📞 GỌI TƯ VẤN
                        </a>
                    </div>
                </div>

                <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 1440 60" preserveAspectRatio="none">
                    <path fill="#022c22" d="M0,40 C480,80 960,0 1440,40 L1440,60 L0,60 Z" />
                </svg>
            </section>

            {/* ═══════ BENEFITS ═══════ */}
            <section className="bg-[#022c22] py-8 sm:py-12 md:py-16">
                <div className="mx-auto max-w-[1040px] px-3 sm:px-4">
                    <RevealSection>
                        {(visible) => (
                            <div className={visible ? "ld-fade-up" : "opacity-0"}>
                                <h2 className="text-center text-lg sm:text-xl md:text-2xl font-bold text-emerald-50">
                                    🎖️ Quyền Lợi Dành Cho Anh Em
                                </h2>
                                <p className="mt-1.5 sm:mt-2 text-center text-xs sm:text-sm text-emerald-300/70">
                                    Chương trình tri ân đặc biệt — không phụ thu, không điều kiện ràng buộc
                                </p>

                                <div className="mt-5 sm:mt-8 grid grid-cols-1 min-[400px]:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
                                    {BENEFITS.map((b, i) => (
                                        <div
                                            key={b.title}
                                            className={`rounded-xl sm:rounded-2xl border border-emerald-700/40 bg-emerald-900/40 p-3.5 sm:p-5 backdrop-blur-sm transition hover:border-emerald-600/50 hover:bg-emerald-900/60 ${visible ? `ld-fade-up ld-d${i + 1}` : "opacity-0"}`}
                                        >
                                            <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-xl bg-emerald-800/60 text-lg sm:text-xl">
                                                {b.icon}
                                            </div>
                                            <h3 className="mt-2 sm:mt-3 text-sm font-bold text-emerald-50">{b.title}</h3>
                                            <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs text-emerald-300/70 leading-relaxed">{b.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </RevealSection>
                </div>
            </section>

            {/* ═══════ FORM ĐĂNG KÝ ═══════ */}
            <section ref={formRef} className="bg-[#022c22] py-8 sm:py-12 md:py-16" id="dang-ky">
                <div className="mx-auto max-w-[1040px] px-3 sm:px-4">
                    <RevealSection>
                        {(visible) => (
                            <div className={visible ? "ld-fade-up" : "opacity-0"}>
                                <h2 className="text-center text-lg sm:text-xl md:text-2xl font-bold text-emerald-50">
                                    📋 Đăng Ký Nhận Ưu Đãi
                                </h2>
                                <p className="mt-1.5 sm:mt-2 text-center text-xs sm:text-sm text-emerald-300/70">
                                    Để lại thông tin, Thầy Duy liên hệ xác nhận trong 15 phút
                                </p>

                                <div className="mx-auto mt-5 sm:mt-8 max-w-md">
                                    {status === "success" ? (
                                        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-900/60 p-6 text-center shadow-lg backdrop-blur-sm animate-fadeInUp">
                                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-700/50 text-3xl float">
                                                ✅
                                            </div>
                                            <h3 className="mt-4 text-lg font-bold text-emerald-50">
                                                Đăng ký thành công!
                                            </h3>
                                            <p className="mt-2 text-sm text-emerald-300/80">
                                                Cảm ơn anh em! Thầy Duy sẽ gọi xác nhận ưu đãi miễn phí trong ít phút.
                                            </p>
                                            <a
                                                href={HOTLINE_TEL}
                                                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-amber-400"
                                            >
                                                📞 Gọi ngay: {HOTLINE}
                                            </a>
                                        </div>
                                    ) : (
                                        <div className="rounded-xl sm:rounded-2xl border border-emerald-700/40 bg-emerald-900/40 p-4 sm:p-6 shadow-lg backdrop-blur-sm">
                                            {/* Promo badge */}
                                            <div className="mb-4 sm:mb-5 flex items-center justify-center gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 sm:px-4 py-2 sm:py-2.5">
                                                <span className="text-base sm:text-lg">🪖</span>
                                                <span className="text-xs sm:text-sm font-bold text-amber-300">Bộ đội xuất ngũ — Miễn phí 100%</span>
                                            </div>

                                            {status === "submitting" && (
                                                <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 animate-pulse">
                                                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                                                    Đang gửi đăng ký…
                                                </div>
                                            )}
                                            {status === "error" && errorMsg && (
                                                <div className="mb-4 rounded-xl border border-red-500/30 bg-red-900/30 px-4 py-3 text-sm text-red-300">
                                                    ⚠️ {errorMsg}
                                                </div>
                                            )}

                                            <form className="space-y-4" onSubmit={onManualSubmit}>
                                                <div>
                                                    <label className="mb-1.5 block text-xs font-semibold text-emerald-300/80">Họ và tên</label>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={fullName}
                                                            onChange={(e) => { setFullName(e.target.value); if (status === "error") setStatus("idle"); }}
                                                            onFocus={onFirstFocus}
                                                            placeholder="Nguyễn Văn A"
                                                            autoComplete="name"
                                                            className={inputCls}
                                                        />
                                                        {nameValid && (
                                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-400 text-sm">✓</span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="mb-1.5 block text-xs font-semibold text-emerald-300/80">Số điện thoại</label>
                                                    <div className="relative">
                                                        <input
                                                            type="tel"
                                                            value={phone}
                                                            onChange={(e) => { setPhone(e.target.value); if (status === "error") setStatus("idle"); }}
                                                            onFocus={onFirstFocus}
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter") {
                                                                    e.preventDefault();
                                                                    if (debounceTimer.current) clearTimeout(debounceTimer.current);
                                                                    if (isValidName(fullName) && isValidPhone(phone) && province && licenseType)
                                                                        doSubmit(fullName, phone, province, licenseType);
                                                                }
                                                            }}
                                                            placeholder="0948 742 666"
                                                            autoComplete="tel"
                                                            inputMode="tel"
                                                            className={inputCls}
                                                        />
                                                        {phoneValid && (
                                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-400 text-sm">✓</span>
                                                        )}
                                                    </div>
                                                    {phone.length > 0 && !phoneValid && (
                                                        <p className="mt-1 text-xs text-emerald-400/60">Nhập 10 số bắt đầu bằng 0</p>
                                                    )}
                                                </div>



                                                <div>
                                                    <label className="mb-1.5 block text-xs font-semibold text-emerald-300/80">Hạng bằng muốn học</label>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        {VETERAN_LICENSE_TYPES.map((lt) => (
                                                            <button
                                                                type="button"
                                                                key={lt.value}
                                                                onClick={() => { setLicenseType(lt.value); if (status === "error") setStatus("idle"); }}
                                                                className={`rounded-xl border-2 p-3 text-left transition-all ${licenseType === lt.value
                                                                    ? "border-amber-400 bg-amber-500/15 shadow-lg shadow-amber-500/10"
                                                                    : "border-emerald-700/40 bg-emerald-900/30 hover:border-emerald-600/50"
                                                                    }`}
                                                            >
                                                                <div className="text-sm font-bold text-emerald-50">Hạng {lt.value}</div>
                                                                <div className="mt-0.5 text-[11px] font-semibold text-amber-400">{lt.price}</div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Honeypot */}
                                                <input type="text" name="_hp" className="hidden" tabIndex={-1} autoComplete="off" />

                                                <button
                                                    type="submit"
                                                    disabled={status === "submitting"}
                                                    className="ld-pulse h-13 w-full rounded-xl bg-amber-500 text-sm font-bold text-white shadow-lg shadow-amber-500/25 transition-all hover:bg-amber-400 disabled:opacity-60 active:scale-[0.97] py-3.5"
                                                >
                                                    {status === "submitting" ? "Đang gửi..." : "🪖 ĐĂNG KÝ MIỄN PHÍ"}
                                                </button>

                                                {nameValid && phoneValid && province && licenseType && status === "idle" && (
                                                    <p className="text-center text-xs text-amber-400/80 animate-pulse">
                                                        ✨ Đang tự động gửi đăng ký cho bạn…
                                                    </p>
                                                )}
                                            </form>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </RevealSection>
                </div>
            </section>

            {/* ═══════ FOOTER CTA ═══════ */}
            <section className="border-t border-emerald-800/50 bg-emerald-950 py-8 sm:py-10 pb-24 sm:pb-10">
                <div className="mx-auto max-w-[1040px] px-3 sm:px-4 text-center">
                    <p className="text-xs sm:text-sm text-emerald-300/60">
                        Liên hệ ngay để được tư vấn chi tiết
                    </p>
                    <a
                        href={HOTLINE_TEL}
                        className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 sm:px-6 py-2.5 sm:py-3 text-sm font-bold text-white transition hover:bg-amber-400"
                    >
                        📞 Hotline: {HOTLINE}
                    </a>
                    <p className="mt-4 sm:mt-6 text-[10px] sm:text-xs text-emerald-400/40">
                        © {new Date().getFullYear()} Đào Tạo Lái Xe Thầy Duy. Mọi quyền được bảo lưu.
                    </p>
                </div>
            </section>

            {/* ═══════ STICKY CTA (mobile) ═══════ */}
            <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-emerald-800/50 bg-emerald-950/90 px-4 py-3 backdrop-blur-lg md:hidden">
                <div className="flex gap-3">
                    <button
                        onClick={scrollToForm}
                        className="ld-pulse flex-1 rounded-xl bg-amber-500 py-3 text-sm font-bold text-white shadow-lg shadow-amber-500/30 transition hover:bg-amber-400 active:scale-[0.97]"
                    >
                        🪖 ĐĂNG KÝ MIỄN PHÍ
                    </button>
                    <a
                        href={HOTLINE_TEL}
                        className="flex items-center justify-center rounded-xl border border-emerald-600/50 bg-emerald-800/40 px-4 py-3 text-sm font-bold text-emerald-100 transition hover:bg-emerald-800/60"
                    >
                        📞
                    </a>
                </div>
            </div>
        </div>
    );
}
