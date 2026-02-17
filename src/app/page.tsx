"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { guardByAuthMe } from "@/lib/ui-auth-guard";
import { Spinner } from "@/components/ui/spinner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const router = useRouter();
  const guardStartedRef = useRef(false);
  const [message, setMessage] = useState("Đang chuyển hướng...");
  const [error, setError] = useState("");

  useEffect(() => {
    if (guardStartedRef.current) return;
    guardStartedRef.current = true;
    guardByAuthMe(router).then((result) => {
      if (result.state === "ok") {
        router.replace("/dashboard");
        return;
      }
      if (result.state === "unauthorized") {
        setMessage("Đang chuyển đến trang đăng nhập...");
        return;
      }
      if (result.state === "forbidden") {
        setMessage("Bạn không có quyền truy cập.");
        return;
      }
      setError(result.message);
    });
  }, [router]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 p-4">
        <div className="w-full max-w-md space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <Alert type="error" message={error} />
          <Button onClick={() => window.location.reload()}>Thử lại</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100">
      <div className="flex items-center gap-2 text-zinc-700">
        <Spinner /> {message}
      </div>
    </div>
  );
}
