import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    requireAuth(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const phone = body.phone?.trim() || null;

  const lead = await prisma.lead.create({
    data: {
      fullName: body.fullName || null,
      phone,
      province: body.province || null,
      licenseType: body.licenseType || null,
      source: body.source || "manual",
      channel: body.channel || "manual",
      status: phone ? "HAS_PHONE" : "NEW",
      note: body.note || null,
      tags: Array.isArray(body.tags) ? body.tags : [],
    },
  });

  return NextResponse.json({ lead });
}
