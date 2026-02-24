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
                            {status === "success" ? (
                                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center shadow-sm animate-fadeInUp">
                                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-2xl">
                                        ✅
                                    </div>
                                    <h3 className="mt-3 text-base font-semibold text-slate-900">
                                        Đã gửi thành công!
                                    </h3>
                                    <p className="mt-1 text-sm text-slate-500">
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
                                <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
                                    {/* Status bar */}
                                    {status === "submitting" && (
                                        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 animate-pulse">
                                            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                                            Đang gửi đăng ký…
                                        </div>
                                    )}
                                    {status === "error" && errorMsg && (
                                        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                            ⚠️ {errorMsg}
                                        </div>
                                    )}

                                    <form className="space-y-3" onSubmit={onManualSubmit}>
                                        <div>
                                            <label className="mb-1 block text-xs font-medium text-slate-600">Họ và tên</label>
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
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 text-sm">✓</span>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-xs font-medium text-slate-600">Số điện thoại</label>
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
                                                    className={inputCls}
                                                />
                                                {phoneValid && (
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 text-sm">✓</span>
                                                )}
                                            </div>
                                            {phone.length > 0 && !phoneValid && (
                                                <p className="mt-1 text-xs text-slate-400">Nhập 10 số bắt đầu bằng 0</p>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="mb-1 block text-xs font-medium text-slate-600">Tỉnh / Thành</label>
                                                <select
                                                    value={province}
                                                    onChange={(e) => { setProvince(e.target.value); setProvinceChanged(true); if (status === "error") setStatus("idle"); }}
                                                    className={inputCls}
                                                >
                                                    <option value="">-- Chọn tỉnh --</option>
                                                    {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="mb-1 block text-xs font-medium text-slate-600">Hạng bằng</label>
                                                <select
                                                    value={licenseType}
                                                    onChange={(e) => { setLicenseType(e.target.value); setLicenseChanged(true); if (status === "error") setStatus("idle"); }}
                                                    className={inputCls}
                                                >
                                                    <option value="">-- Chọn hạng --</option>
                                                    {LICENSE_TYPES.map((l) => <option key={l} value={l}>{l}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        {/* Honeypot anti-spam */}
                                        <input type="text" name="_hp" className="hidden" tabIndex={-1} autoComplete="off" />

                                        {/* Submit button - still visible as fallback */}
                                        <button
                                            type="submit"
                                            disabled={status === "submitting"}
                                            className="ld-pulse h-12 w-full rounded-xl bg-amber-500 text-sm font-bold text-white shadow-md shadow-amber-500/20 transition-all hover:bg-amber-600 disabled:opacity-60 active:scale-[0.97]"
                                        >
                                            {status === "submitting" ? "Đang gửi..." : "GỬI ĐĂNG KÝ"}
                                        </button>

                                        {/* Auto-submit hint */}
                                        {nameValid && phoneValid && provinceChanged && licenseChanged && province && licenseType && status === "idle" && (
                                            <p className="text-center text-xs text-emerald-600 animate-pulse">
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
        </section>
    );
}
