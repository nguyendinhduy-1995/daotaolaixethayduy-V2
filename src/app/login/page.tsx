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

/* ─── greeting logic ─── */
function getGreeting(): { icon: string; text: string } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour <= 10) {
    return {
      icon: "☀️",
      text: "Chúc bạn có 1 ngày làm việc hiệu quả và năng lượng",
    };
  }
  if (hour >= 11 && hour <= 16) {
    return {
      icon: "☕",
      text: "Hãy làm 1 ly Cafe để hoàn thành thật tốt công việc và đạt KPI nhé",
    };
  }
  return {
    icon: "🌙",
    text: "Làm việc hiệu quả, sắp xếp thời gian linh hoạt để nghỉ ngơi nữa nhé",
  };
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

  /* greeting: render after mount to avoid SSR mismatch */
  const [greeting, setGreeting] = useState<{ icon: string; text: string } | null>(null);
  useEffect(() => {
    setGreeting(getGreeting());
  }, []);

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

  const year = new Date().getFullYear();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100 px-4">
      {/* subtle background blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full bg-indigo-100/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-32 h-[400px] w-[400px] rounded-full bg-amber-100/30 blur-3xl"
      />

      <div className="relative z-10 w-full max-w-[420px]">
        {/* ─── card ─── */}
        <div className="rounded-2xl border border-slate-200/70 bg-white/95 px-6 py-8 shadow-sm backdrop-blur-sm sm:px-8 sm:py-10">
          {/* header */}
          <div className="text-center">
            {/* logo icon */}
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 shadow-md">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6 text-white"
              >
                <path d="M5 17h14M5 17a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2M5 17l-1 3m15-3 1 3" />
                <circle cx="7.5" cy="17" r="2.5" />
                <circle cx="16.5" cy="17" r="2.5" />
              </svg>
            </div>

            <h1 className="mt-4 text-lg font-semibold tracking-tight text-slate-900">
              Thầy Duy Đào Tạo Lái Xe
            </h1>
            <p className="mt-0.5 text-[13px] text-slate-500">
              CRM &amp; vận hành đào tạo lái xe
            </p>

            {/* greeting */}
            {greeting && (
              <p className="mt-3 text-[13px] leading-relaxed text-slate-400">
                <span className="mr-1 text-sm">{greeting.icon}</span>
                {greeting.text}
              </p>
            )}
          </div>

          {/* ─── form ─── */}
          <form className="mt-7 space-y-4" onSubmit={onSubmit}>
            {/* account field */}
            <div>
              <label
                htmlFor="login-account"
                className="mb-1.5 block text-[13px] font-medium text-slate-700"
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
                className="block w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200"
              />
            </div>

            {/* password field */}
            <div>
              <label
                htmlFor="login-password"
                className="mb-1.5 block text-[13px] font-medium text-slate-700"
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
                  className="block w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 pr-10 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 transition-colors hover:text-slate-600"
                  aria-label={showPw ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showPw ? (
                    /* EyeOff */
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <path d="m14.12 14.12a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    /* Eye */
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5">
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
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
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

        {/* ─── footer ─── */}
        <p className="mt-5 text-center text-[11px] text-slate-400">
          © {year} Thầy Duy — Vào làm là phải đạt KPI 🎯
        </p>
      </div>
    </div>
  );
}
