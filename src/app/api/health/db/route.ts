import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  // Query nhẹ nhất để test DB: lấy 1 user (chưa có cũng ok)
  await prisma.user.findFirst();

  return NextResponse.json({ ok: true, db: "connected" });
}
