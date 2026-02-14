import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { setStudentAuthCookie } from "@/lib/student-auth-cookies";
import { signStudentAccessToken } from "@/lib/jwt";
import { ensureStudentPortalSchema } from "@/lib/student-portal-db";

function normalizePhone(value: string) {
  return value.replace(/\s+/g, "").trim();
}

export async function POST(req: Request) {
  try {
    await ensureStudentPortalSchema();
    const body = await req.json().catch(() => null);
    const phone = typeof body?.phone === "string" ? normalizePhone(body.phone) : "";
    const password = typeof body?.password === "string" ? body.password : "";
    if (!phone || !password) {
      return jsonError(400, "VALIDATION_ERROR", "Thiếu số điện thoại/mật khẩu");
    }

    const account = await prisma.studentAccount.findUnique({
      where: { phone },
      include: { student: { include: { lead: true } } },
    });
    if (!account) return jsonError(401, "AUTH_INVALID_TOKEN", "Thông tin đăng nhập không hợp lệ");
    const ok = await bcrypt.compare(password, account.passwordHash);
    if (!ok) return jsonError(401, "AUTH_INVALID_TOKEN", "Thông tin đăng nhập không hợp lệ");

    const accessToken = signStudentAccessToken({
      sub: account.id,
      role: "student",
      phone: account.phone,
      studentId: account.studentId,
    });

    const response = NextResponse.json({
      ok: true,
      accessToken,
      tokenType: "Bearer",
      student: {
        id: account.student.id,
        fullName: account.student.lead.fullName,
        phone: account.student.lead.phone,
      },
    });
    setStudentAuthCookie(response, accessToken);
    return response;
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
