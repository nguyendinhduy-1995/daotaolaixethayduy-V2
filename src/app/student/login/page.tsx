"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function StudentLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/student/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error?.message || "Đăng nhập thất bại");
      setLoading(false);
      return;
    }
    router.replace("/student");
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-zinc-900">Đăng nhập học viên</h1>
      <p className="mt-1 text-sm text-zinc-500">Nhập số điện thoại và mật khẩu để tiếp tục.</p>
      {error ? <div className="mt-3"><Alert type="error" message={error} /></div> : null}
      <form className="mt-4 space-y-3" onSubmit={onSubmit}>
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Số điện thoại" />
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mật khẩu" />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Đang đăng nhập..." : "Đăng nhập"}
        </Button>
      </form>
      <p className="mt-4 text-sm text-zinc-600">
        Chưa có tài khoản?{" "}
        <Link href="/student/register" className="text-blue-700 hover:underline">
          Đăng ký ngay
        </Link>
      </p>
    </div>
  );
}
