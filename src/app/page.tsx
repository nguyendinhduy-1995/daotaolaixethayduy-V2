"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchMe } from "@/lib/auth-client";
import { Spinner } from "@/components/ui/spinner";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    fetchMe()
      .then(() => router.replace("/dashboard"))
      .catch(() => router.replace("/login"));
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100">
      <div className="flex items-center gap-2 text-zinc-700">
        <Spinner /> Đang chuyển hướng...
      </div>
    </div>
  );
}
