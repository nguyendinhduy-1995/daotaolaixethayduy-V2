"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    const res = await fetch("/api/student/auth/register", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: studentId || undefined, profileCode: profileCode || undefined, phone, password }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error?.message || "Đăng ký thất bại");
      setLoading(false);
      return;
    }
    router.replace("/student");
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-zinc-900">Đăng ký học viên</h1>
      <p className="mt-1 text-sm text-zinc-500">Liên kết hồ sơ học viên bằng mã học viên hoặc mã hồ sơ.</p>
      {error ? <div className="mt-3"><Alert type="error" message={error} /></div> : null}
      <form className="mt-4 space-y-3" onSubmit={onSubmit}>
        <Input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="Mã học viên (ưu tiên)" />
        <Input value={profileCode} onChange={(e) => setProfileCode(e.target.value)} placeholder="Mã hồ sơ (nếu không có mã học viên)" />
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Số điện thoại" />
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mật khẩu (>=8 ký tự)" />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Đang đăng ký..." : "Đăng ký"}
        </Button>
      </form>
      <p className="mt-4 text-sm text-zinc-600">
        Đã có tài khoản?{" "}
        <Link href="/student/login" className="text-blue-700 hover:underline">
          Đăng nhập
        </Link>
      </p>
    </div>
  );
}
