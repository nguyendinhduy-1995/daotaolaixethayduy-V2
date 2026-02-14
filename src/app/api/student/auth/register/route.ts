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
    if (!body || typeof body !== "object") {
      return jsonError(400, "VALIDATION_ERROR", "Invalid JSON body");
    }

    const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : "";
    const password = typeof body.password === "string" ? body.password : "";
    const studentId = typeof body.studentId === "string" ? body.studentId : "";
    const profileCode = typeof body.profileCode === "string" ? body.profileCode : "";

    if (!phone || password.length < 8) {
      return jsonError(400, "VALIDATION_ERROR", "Số điện thoại hoặc mật khẩu không hợp lệ");
    }
    if (!studentId && !profileCode) {
      return jsonError(400, "VALIDATION_ERROR", "Thiếu mã học viên/mã hồ sơ");
    }

    const student = studentId
      ? await prisma.student.findUnique({ where: { id: studentId }, include: { lead: true } })
      : await prisma.student.findFirst({
          where: {
            OR: [{ id: profileCode }, { leadId: profileCode }, { lead: { phone: profileCode } }],
          },
          include: { lead: true },
        });
    if (!student) return jsonError(404, "NOT_FOUND", "Không tìm thấy học viên");

    const existed = await prisma.studentAccount.findFirst({
      where: { OR: [{ phone }, { studentId: student.id }] },
      select: { id: true },
    });
    if (existed) return jsonError(400, "VALIDATION_ERROR", "Tài khoản đã tồn tại");

    const passwordHash = await bcrypt.hash(password, 10);
    const account = await prisma.studentAccount.create({
      data: { phone, passwordHash, studentId: student.id },
    });

    const accessToken = signStudentAccessToken({
      sub: account.id,
      role: "student",
      phone: account.phone,
      studentId: student.id,
    });

    const response = NextResponse.json({
      ok: true,
      accessToken,
      tokenType: "Bearer",
      student: {
        id: student.id,
        fullName: student.lead.fullName,
        phone: student.lead.phone,
      },
    });
    setStudentAuthCookie(response, accessToken);
    return response;
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
