"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { guardByAuthMe } from "@/lib/ui-auth-guard";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/app-meta";

type LoginResponse = {
  accessToken?: string;
  token?: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [account, setAccount] = useState("Nguyendinhduy");
  const [password, setPassword] = useState("Nguyendinhduy@95");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const guardStartedRef = useRef(false);

  useEffect(() => {
    if (guardStartedRef.current) return;
    guardStartedRef.current = true;
    guardByAuthMe(router, { redirectOnUnauthorized: false }).then((result) => {
      if (result.state === "ok") router.replace("/leads");
    });
  }, [router]);

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
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">{APP_NAME}</h1>
        <p className="mt-1 text-sm text-zinc-500">{APP_DESCRIPTION}</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="mb-1 block text-sm text-zinc-700">Tài khoản (username hoặc email)</label>
            <Input value={account} onChange={(e) => setAccount(e.target.value)} type="text" required />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-700">Mật khẩu</label>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
          </div>
          {error ? <Alert type="error" message={error} /> : null}
          <Button className="w-full" type="submit" disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <Spinner /> Đang đăng nhập...
              </span>
            ) : (
              "Đăng nhập"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
