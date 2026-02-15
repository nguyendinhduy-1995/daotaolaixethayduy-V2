"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { guardByAuthMe } from "@/lib/ui-auth-guard";
import { Spinner } from "@/components/ui/spinner";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    guardByAuthMe(router).then((user) => {
      if (user) router.replace("/dashboard");
    });
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100">
      <div className="flex items-center gap-2 text-zinc-700">
        <Spinner /> Đang chuyển hướng...
      </div>
    </div>
  );
}
