"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function StudentRegisterPage() {
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [profileCode, setProfileCode] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/student/auth/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: studentId || undefined,
          profileCode: profileCode || undefined,
          phone,
          password,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message || "Đăng ký thất bại");
        return;
      }
      router.replace("/student");
    } catch {
      setError("Lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-2xl shadow">
            🚗
          </div>
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">
            Đăng ký học viên
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Liên kết hồ sơ bằng mã học viên hoặc mã hồ sơ
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
          {/* Ghi chú */}
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs leading-relaxed text-slate-600">
              💡 Bạn cần có <strong>mã học viên</strong> hoặc{" "}
              <strong>mã hồ sơ</strong> từ nhà trường. Liên hệ hotline nếu
              chưa có.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              ⚠️ {error}
            </div>
          )}

          <form className="space-y-3" onSubmit={onSubmit}>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Mã học viên <span className="text-slate-400">(ưu tiên)</span>
              </label>
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="Mã từ nhà trường"
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Mã hồ sơ <span className="text-slate-400">(nếu không có mã HV)</span>
              </label>
              <input
                type="text"
                value={profileCode}
                onChange={(e) => setProfileCode(e.target.value)}
                placeholder="Mã hồ sơ hoặc SĐT đăng ký"
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Số điện thoại
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0948 742 666"
                required
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Mật khẩu <span className="text-slate-400">(≥ 8 ký tự)</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                className={inputCls}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-xl bg-amber-500 text-sm font-bold text-white shadow-md shadow-amber-500/20 transition-all hover:bg-amber-600 disabled:opacity-60 active:scale-[0.97]"
            >
              {loading ? "Đang đăng ký..." : "Đăng ký"}
            </button>
          </form>
        </div>

        {/* Links */}
        <div className="mt-4 space-y-2 text-center text-sm">
          <p className="text-slate-500">
            Đã có tài khoản?{" "}
            <Link
              href="/student/login"
              className="font-semibold text-amber-600 hover:text-amber-700"
            >
              Đăng nhập
            </Link>
          </p>
          <Link
            href="/"
            className="inline-block text-slate-400 transition hover:text-slate-600"
          >
            ← Về trang chủ
          </Link>
        </div>

        {/* Hotline */}
        <div className="mt-6 text-center">
          <a
            href="tel:0948742666"
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-amber-100"
          >
            📞 Hotline: <span className="font-bold">0948 742 666</span>
          </a>
        </div>
      </div>
    </div>
  );
}
