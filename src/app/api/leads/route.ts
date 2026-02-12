import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireAuth } from "@/lib/auth";
import { jsonError } from "@/lib/api-response";

export async function POST(req: Request) {
  try {
    requireAuth(req);
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.status, error.code, error.message);
    }
    return jsonError(401, "UNAUTHORIZED", "Unauthorized");
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body) return jsonError(400, "BAD_REQUEST", "Invalid JSON");

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
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
