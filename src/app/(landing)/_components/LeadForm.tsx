"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RevealSection, HOTLINE, HOTLINE_TEL, PROVINCES, LICENSE_TYPES } from "./LandingStyles";
import { trackMetaEvent } from "@/lib/meta-pixel";

/**
 * Phone validation: 10–11 digits starting with 0
 * Also accepts +84 prefix (converted to 0 internally).
 */
function normalizePhone(raw: string): string {
    const stripped = raw.replace(/[\s\-().]+/g, "");
    if (stripped.startsWith("+84")) return "0" + stripped.slice(3);
    return stripped;
}

function isValidPhone(raw: string): boolean {
    const p = normalizePhone(raw);
    return /^0\d{8,10}$/.test(p);
}

function isValidName(name: string): boolean {
    return name.trim().length >= 2;
}

/** Idempotency key: phone + date → prevent duplicate submits per day */
function idempotencyKey(phone: string): string {
    const d = new Date().toISOString().slice(0, 10);
    return `lead_${normalizePhone(phone)}_${d}`;
}

/** Track analytics event via site tracker (if available) */
function trackSiteEvent(eventType: string, extra?: Record<string, unknown>) {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window as any;
        if (typeof w?.__trackEvent === "function") {
            w.__trackEvent(eventType, extra);
        }
    } catch { /* ignore */ }
}

export default function LeadForm() {
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [province, setProvince] = useState("");
    const [licenseType, setLicenseType] = useState("");

    const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Track user interactions with dropdowns
    const [provinceChanged, setProvinceChanged] = useState(false);
    const [licenseChanged, setLicenseChanged] = useState(false);

    // Track which events we already fired
    const firedEvents = useRef({ start: false, complete: false, submitted: new Set<string>() });
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Analytics: form start (first focus) ──
    function onFirstFocus() {
        if (!firedEvents.current.start) {
            firedEvents.current.start = true;
            trackSiteEvent("lead_form_start");
        }
    }

    // ── Core submit logic ──
    const doSubmit = useCallback(async (name: string, ph: string, prov: string, lt: string) => {
        const normPhone = normalizePhone(ph);
        const key = idempotencyKey(normPhone);

        // Prevent duplicate submit for same phone + date
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
                }),
            });

            const data = await res.json().catch(() => null);

            if (!res.ok) {
                const msg = data?.error?.message || `Gửi thất bại (${res.status}). Vui lòng thử lại.`;
                setStatus("error");
                setErrorMsg(msg);
                trackSiteEvent("lead_submit_fail", { error: msg });
                return;
            }

            // Success!
            firedEvents.current.submitted.add(key);
            setStatus("success");
            trackSiteEvent("lead_submit_success", { phone: normPhone });

            // Meta Pixel events
            trackMetaEvent("Lead", {
                content_name: "LeadForm",
                content_category: lt,
            }, { phone: normPhone });
            trackMetaEvent("CompleteRegistration", {
                content_name: "LeadForm",
                status: "success",
            }, { phone: normPhone });

            // GA4 event
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const w = window as any;
                if (typeof w?.gtag === "function") {
                    w.gtag("event", "generate_lead", { currency: "VND", value: 1 });
                }
            } catch { /* ignore */ }
        } catch {
            setStatus("error");
            setErrorMsg("Lỗi kết nối. Bấm GỬI để thử lại.");
            trackSiteEvent("lead_submit_fail", { error: "network" });
        } finally {
            setIsSubmitting(false);
        }
    }, [isSubmitting]);

    // ── Auto-submit: triggers when province AND licenseType are selected ──
    const tryAutoSubmit = useCallback(() => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);

        // All 4 fields must be valid AND user must have actively selected province + license
        if (!isValidName(fullName) || !isValidPhone(phone)) return;
        if (!provinceChanged || !licenseChanged) return;
        if (!province || !licenseType) return;

        // Fire "complete" analytics event once
        if (!firedEvents.current.complete) {
            firedEvents.current.complete = true;
            trackSiteEvent("lead_form_complete", { phone: normalizePhone(phone) });
        }

        // Debounce 800ms after user selects dropdown
        debounceTimer.current = setTimeout(() => {
            doSubmit(fullName, phone, province, licenseType);
        }, 800);
    }, [doSubmit, fullName, phone, province, licenseType, provinceChanged, licenseChanged]);

    // ── Trigger auto-submit when province or licenseType changes ──
    useEffect(() => {
        if (status === "success") return;
        tryAutoSubmit();
        return () => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
        };
    }, [provinceChanged, licenseChanged, province, licenseType, tryAutoSubmit, status]);

    // ── Manual submit (form submit or Enter) ──
    function onManualSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (status === "success") return;
        if (debounceTimer.current) clearTimeout(debounceTimer.current);

        if (!isValidName(fullName)) {
            setStatus("error");
            setErrorMsg("Vui lòng nhập họ và tên.");
            return;
        }
        if (!isValidPhone(phone)) {
            setStatus("error");
            setErrorMsg("Số điện thoại không hợp lệ. Vui lòng nhập 10 số bắt đầu bằng 0.");
            return;
        }
        if (!province) {
            setStatus("error");
            setErrorMsg("Vui lòng chọn tỉnh / thành phố.");
            return;
        }
        if (!licenseType) {
            setStatus("error");
            setErrorMsg("Vui lòng chọn hạng bằng.");
            return;
        }
        doSubmit(fullName, phone, province, licenseType);
    }

    // ── Enter key on phone field → trigger submit ──
    function onPhoneKeyDown(e: React.KeyboardEvent) {
        if (e.key === "Enter") {
            e.preventDefault();
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
            if (isValidName(fullName) && isValidPhone(phone) && province && licenseType) {
                doSubmit(fullName, phone, province, licenseType);
            }
        }
    }

    const inputCls =
        "h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30";

    const phoneValid = isValidPhone(phone);
    const nameValid = isValidName(fullName);

    return (
        <section
            className="relative overflow-hidden py-12 md:py-16"
            style={{ background: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)" }}
        >
            {/* Decorative glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full opacity-20 pointer-events-none" style={{ background: "radial-gradient(circle, #f59e0b 0%, transparent 70%)" }} />

            <div className="relative z-10 mx-auto max-w-[1040px] px-4">
                <RevealSection>
                    {(visible) => (
                        <div className={visible ? "ld-fade-up" : "opacity-0"}>
                            {/* Header */}
                            <div className="text-center mb-6">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-500/30 px-3 py-1 text-xs font-bold text-amber-400 mb-4">
                                    ✍️ Đăng ký tư vấn miễn phí
                                </span>
                                <h2 className="text-xl font-extrabold text-white md:text-2xl">
                                    Nhận Tư Vấn Trong <span className="text-amber-400">15 Phút</span>
                                </h2>
                                <p className="mt-1.5 text-sm text-slate-400">
                                    Để lại thông tin — Thầy Duy gọi tư vấn ngay
                                </p>

                                {/* Live activity indicator */}
                                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-800 px-3 py-1.5 text-xs text-slate-300">
                                    <span className="relative flex h-2 w-2">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                                    </span>
                                    <span>43 người đang xem trang này</span>
                                </div>
                            </div>

                            <div className="mx-auto max-w-md">
                                {status === "success" ? (
                                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-900/30 p-6 text-center shadow-lg backdrop-blur-sm animate-fadeInUp">
                                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-3xl">
                                            ✅
                                        </div>
                                        <h3 className="mt-3 text-lg font-bold text-white">
                                            Đã gửi thành công!
                                        </h3>
                                        <p className="mt-1.5 text-sm text-slate-300">
                                            Thầy Duy sẽ gọi xác nhận trong ít phút.
                                        </p>
                                        <a
                                            href={HOTLINE_TEL}
                                            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-amber-600"
                                        >
                                            📞 Gọi ngay: {HOTLINE}
                                        </a>
                                    </div>
                                ) : (
                                    <div
                                        className="rounded-2xl p-5 md:p-6 shadow-xl"
                                        style={{
                                            background: "rgba(255,255,255,0.07)",
                                            backdropFilter: "blur(16px)",
                                            border: "1px solid rgba(255,255,255,0.1)",
                                        }}
                                    >
                                        {/* Status bar */}
                                        {status === "submitting" && (
                                            <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 animate-pulse">
                                                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                                                Đang gửi đăng ký…
                                            </div>
                                        )}
                                        {status === "error" && errorMsg && (
                                            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                                                ⚠️ {errorMsg}
                                            </div>
                                        )}

                                        <form className="space-y-3" onSubmit={onManualSubmit}>
                                            <div>
                                                <label className="mb-1 block text-xs font-medium text-slate-300">Họ và tên</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={fullName}
                                                        onChange={(e) => { setFullName(e.target.value); if (status === "error") setStatus("idle"); }}
                                                        onFocus={onFirstFocus}
                                                        placeholder="Nguyễn Văn A"
                                                        autoComplete="name"
                                                        className="h-12 w-full rounded-xl border border-slate-600 bg-slate-800/80 px-4 text-sm text-white placeholder:text-slate-500 transition-all focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                                                    />
                                                    {nameValid && (
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400 text-sm">✓</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="mb-1 block text-xs font-medium text-slate-300">Số điện thoại</label>
                                                <div className="relative">
                                                    <input
                                                        type="tel"
                                                        value={phone}
                                                        onChange={(e) => { setPhone(e.target.value); if (status === "error") setStatus("idle"); }}
                                                        onFocus={onFirstFocus}
                                                        onKeyDown={onPhoneKeyDown}
                                                        placeholder="0948 742 666"
                                                        autoComplete="tel"
                                                        inputMode="tel"
                                                        className="h-12 w-full rounded-xl border border-slate-600 bg-slate-800/80 px-4 text-sm text-white placeholder:text-slate-500 transition-all focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                                                    />
                                                    {phoneValid && (
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400 text-sm">✓</span>
                                                    )}
                                                </div>
                                                {phone.length > 0 && !phoneValid && (
                                                    <p className="mt-1 text-xs text-slate-500">Nhập 10 số bắt đầu bằng 0</p>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="mb-1 block text-xs font-medium text-slate-300">Tỉnh / Thành</label>
                                                    <select
                                                        value={province}
                                                        onChange={(e) => { setProvince(e.target.value); setProvinceChanged(true); if (status === "error") setStatus("idle"); }}
                                                        className="h-12 w-full rounded-xl border border-slate-600 bg-slate-800/80 px-4 text-sm text-white transition-all focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                                                    >
                                                        <option value="">-- Chọn tỉnh --</option>
                                                        {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="mb-1 block text-xs font-medium text-slate-300">Hạng bằng</label>
                                                    <select
                                                        value={licenseType}
                                                        onChange={(e) => { setLicenseType(e.target.value); setLicenseChanged(true); if (status === "error") setStatus("idle"); }}
                                                        className="h-12 w-full rounded-xl border border-slate-600 bg-slate-800/80 px-4 text-sm text-white transition-all focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                                                    >
                                                        <option value="">-- Chọn hạng --</option>
                                                        {LICENSE_TYPES.map((l) => <option key={l} value={l}>{l}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                            {/* Honeypot anti-spam */}
                                            <input type="text" name="_hp" className="hidden" tabIndex={-1} autoComplete="off" />

                                            {/* Submit button */}
                                            <button
                                                type="submit"
                                                disabled={status === "submitting"}
                                                className="ld-pulse h-13 w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-sm font-bold text-white shadow-lg shadow-amber-500/25 transition-all hover:from-amber-600 hover:to-amber-700 disabled:opacity-60 active:scale-[0.97]"
                                                style={{ height: "52px" }}
                                            >
                                                {status === "submitting" ? "Đang gửi..." : "🚗 GỬI ĐĂNG KÝ — MIỄN PHÍ"}
                                            </button>

                                            {/* Auto-submit hint */}
                                            {nameValid && phoneValid && provinceChanged && licenseChanged && province && licenseType && status === "idle" && (
                                                <p className="text-center text-xs text-emerald-400 animate-pulse">
                                                    ✨ Đang tự động gửi đăng ký cho bạn…
                                                </p>
                                            )}
                                        </form>

                                        {/* Trust signals below form */}
                                        <div className="mt-4 flex items-center justify-center gap-3 text-[11px] text-slate-400">
                                            <span className="flex items-center gap-1">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                                    <path d="M7 11V7a5 5 0 0110 0v4" />
                                                </svg>
                                                Bảo mật
                                            </span>
                                            <span className="text-slate-600">·</span>
                                            <span>Miễn phí 100%</span>
                                            <span className="text-slate-600">·</span>
                                            <span>Phản hồi 15 phút</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </RevealSection>
            </div>
        </section>
    );
}

