import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";

export async function GET() {
  try {
    // Query nhẹ nhất để test DB: lấy 1 user (chưa có cũng ok)
    await prisma.user.findFirst();

    return NextResponse.json({ ok: true, db: "connected" });
  } catch {
    return jsonError(500, "DB_UNAVAILABLE", "Database unavailable");
  }
}
