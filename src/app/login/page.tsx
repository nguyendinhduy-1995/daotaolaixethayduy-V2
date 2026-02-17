"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { guardByAuthMe } from "@/lib/ui-auth-guard";
import { Spinner } from "@/components/ui/spinner";

/* ─── types ─── */
type LoginResponse = {
  accessToken?: string;
  token?: string;
};

/* ─── greeting + theme logic ─── */
type TimeTheme = {
  icon: string;
  text: string;
  bg: string;           // background gradient
  blob1: string;        // top-left blob color
  blob2: string;        // bottom-right blob color
  cardBorder: string;
  period: "morning" | "afternoon" | "evening";
};

function getTimeTheme(): TimeTheme {
  const hour = new Date().getHours();

  if (hour >= 5 && hour <= 10) {
    return {
      icon: "☀️",
      text: "Chúc bạn có 1 ngày làm việc hiệu quả và năng lượng",
      bg: "from-amber-50 via-orange-50/40 to-yellow-50",
      blob1: "bg-amber-200/30",
      blob2: "bg-orange-100/30",
      cardBorder: "border-amber-200/50",
      period: "morning",
    };
  }
  if (hour >= 11 && hour <= 16) {
    return {
      icon: "☕",
      text: "Hãy làm 1 ly Cafe để hoàn thành thật tốt công việc và đạt KPI nhé",
      bg: "from-slate-50 via-sky-50/30 to-indigo-50/40",
      blob1: "bg-sky-200/25",
      blob2: "bg-indigo-100/30",
      cardBorder: "border-slate-200/70",
      period: "afternoon",
    };
  }
  return {
    icon: "🌙",
    text: "Làm việc hiệu quả, sắp xếp thời gian linh hoạt để nghỉ ngơi nữa nhé",
    bg: "from-slate-900 via-slate-800 to-indigo-950",
    blob1: "bg-indigo-500/10",
    blob2: "bg-purple-500/10",
    cardBorder: "border-slate-700/50",
    period: "evening",
  };
}

/* ─── typewriter hook ─── */
function useTypewriter(text: string, speed = 40) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(id);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);

  return { displayed, done };
}

/* ─── component ─── */
export default function LoginPage() {
  const router = useRouter();
  const accountRef = useRef<HTMLInputElement>(null);
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const guardStartedRef = useRef(false);

  /* theme: render after mount to avoid SSR mismatch */
  const [theme, setTheme] = useState<TimeTheme | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(getTimeTheme());
    setMounted(true);
  }, []);

  /* typewriter for greeting */
  const { displayed: typedGreeting, done: typingDone } = useTypewriter(
    theme?.text ?? "",
    35
  );

  /* auto-redirect if already logged in */
  useEffect(() => {
    if (guardStartedRef.current) return;
    guardStartedRef.current = true;
    guardByAuthMe(router, { redirectOnUnauthorized: false }).then((result) => {
      if (result.state === "ok") router.replace("/leads");
    });
  }, [router]);

  /* autofocus */
  useEffect(() => {
    accountRef.current?.focus();
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await fetchJson<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: { account, email: account, password },
      });
      router.replace("/leads");
    } catch (e) {
      const err = e as ApiClientError;
      setError(err.message || "Đăng nhập thất bại");
      accountRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  const isEvening = theme?.period === "evening";
  const year = new Date().getFullYear();

  return (
    <div
      className={`relative flex min-h-screen items-center justify-center overflow-hidden px-4 transition-colors duration-700 bg-gradient-to-br ${theme?.bg ?? "from-slate-50 via-white to-slate-100"}`}
    >
      {/* ── animated blobs ── */}
      <div
        aria-hidden
        className={`pointer-events-none absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full blur-3xl transition-colors duration-700 ${theme?.blob1 ?? "bg-indigo-100/40"}`}
        style={{ animation: "float-blob 8s ease-in-out infinite" }}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute -bottom-32 -right-32 h-[400px] w-[400px] rounded-full blur-3xl transition-colors duration-700 ${theme?.blob2 ?? "bg-amber-100/30"}`}
        style={{ animation: "float-blob 10s ease-in-out infinite reverse" }}
      />
      {/* extra blob for depth */}
      <div
        aria-hidden
        className={`pointer-events-none absolute left-1/2 top-1/4 h-[300px] w-[300px] -translate-x-1/2 rounded-full blur-3xl transition-colors duration-700 ${theme?.blob1 ?? "bg-indigo-100/20"} opacity-40`}
        style={{ animation: "float-blob 12s ease-in-out infinite" }}
      />

      {/* ── card ── */}
      <div
        className={`relative z-10 w-full max-w-[420px] transition-all duration-500 ${mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
      >
        <div
          className={`rounded-2xl border px-6 py-8 shadow-lg backdrop-blur-md sm:px-8 sm:py-10 transition-colors duration-500 ${isEvening
              ? `${theme?.cardBorder} bg-slate-800/80`
              : `${theme?.cardBorder ?? "border-slate-200/70"} bg-white/90`
            }`}
        >
          {/* header */}
          <div className="text-center">
            {/* logo with glow */}
            <div className="relative mx-auto h-14 w-14">
              <div
                className={`absolute inset-0 rounded-xl blur-md ${isEvening ? "bg-indigo-500/30" : "bg-slate-900/10"
                  }`}
                style={{ animation: "pulse-glow 3s ease-in-out infinite" }}
              />
              <div
                className={`relative flex h-14 w-14 items-center justify-center rounded-xl shadow-lg ${isEvening ? "bg-indigo-600" : "bg-slate-900"
                  }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-7 w-7 text-white"
                >
                  <path d="M5 17h14M5 17a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2M5 17l-1 3m15-3 1 3" />
                  <circle cx="7.5" cy="17" r="2.5" />
                  <circle cx="16.5" cy="17" r="2.5" />
                </svg>
              </div>
            </div>

            <h1
              className={`mt-5 text-lg font-semibold tracking-tight ${isEvening ? "text-white" : "text-slate-900"
                }`}
            >
              Thầy Duy Đào Tạo Lái Xe
            </h1>
            <p
              className={`mt-0.5 text-[13px] ${isEvening ? "text-slate-400" : "text-slate-500"
                }`}
            >
              CRM &amp; vận hành đào tạo lái xe
            </p>

            {/* greeting with typewriter */}
            {theme && (
              <p
                className={`mt-3 h-10 text-[13px] leading-relaxed ${isEvening ? "text-slate-500" : "text-slate-400"
                  }`}
              >
                <span className="mr-1 text-sm">{theme.icon}</span>
                {typedGreeting}
                {!typingDone && (
                  <span
                    className="ml-0.5 inline-block w-[2px] bg-current align-middle"
                    style={{
                      height: "14px",
                      animation: "blink-cursor 0.7s step-end infinite",
                    }}
                  />
                )}
              </p>
            )}
          </div>

          {/* ── form ── */}
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            {/* account */}
            <div>
              <label
                htmlFor="login-account"
                className={`mb-1.5 block text-[13px] font-medium ${isEvening ? "text-slate-300" : "text-slate-700"
                  }`}
              >
                Tài khoản (SĐT hoặc email)
              </label>
              <input
                ref={accountRef}
                id="login-account"
                type="text"
                autoComplete="username"
                required
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder="username hoặc email"
                className={`block w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:ring-2 ${isEvening
                    ? "border-slate-600 bg-slate-700/50 text-white focus:border-indigo-500 focus:bg-slate-700 focus:ring-indigo-500/20"
                    : "border-slate-200 bg-slate-50/60 text-slate-900 focus:border-slate-400 focus:bg-white focus:ring-slate-200"
                  }`}
              />
            </div>

            {/* password */}
            <div>
              <label
                htmlFor="login-password"
                className={`mb-1.5 block text-[13px] font-medium ${isEvening ? "text-slate-300" : "text-slate-700"
                  }`}
              >
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`block w-full rounded-lg border px-3.5 py-2.5 pr-10 text-sm outline-none transition-all placeholder:text-slate-400 focus:ring-2 ${isEvening
                      ? "border-slate-600 bg-slate-700/50 text-white focus:border-indigo-500 focus:bg-slate-700 focus:ring-indigo-500/20"
                      : "border-slate-200 bg-slate-50/60 text-slate-900 focus:border-slate-400 focus:bg-white focus:ring-slate-200"
                    }`}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPw((v) => !v)}
                  className={`absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 transition-colors ${isEvening
                      ? "text-slate-500 hover:text-slate-300"
                      : "text-slate-400 hover:text-slate-600"
                    }`}
                  aria-label={showPw ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showPw ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <path d="m14.12 14.12a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* error */}
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 shrink-0 text-red-500">
                  <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clipRule="evenodd" />
                </svg>
                <p className="text-[13px] leading-snug text-red-700">{error}</p>
              </div>
            )}

            {/* submit */}
            <button
              type="submit"
              disabled={loading}
              className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${isEvening
                  ? "bg-indigo-600 hover:bg-indigo-500 focus:ring-indigo-400"
                  : "bg-slate-900 hover:bg-slate-800 focus:ring-slate-400"
                }`}
            >
              {loading ? (
                <>
                  <Spinner /> Đang đăng nhập…
                </>
              ) : (
                "Đăng nhập"
              )}
            </button>
          </form>
        </div>

        {/* footer */}
        <p
          className={`mt-5 text-center text-[11px] ${isEvening ? "text-slate-600" : "text-slate-400"
            }`}
        >
          © {year} Thầy Duy — Vào làm là phải đạt KPI 🎯
        </p>
      </div>

      {/* ── keyframe animations ── */}
      <style jsx global>{`
        @keyframes float-blob {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-30px) scale(1.05); }
        }
        @keyframes blink-cursor {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
