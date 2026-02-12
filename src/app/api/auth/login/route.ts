import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body?.email || !body?.password) {
      return jsonError(400, "BAD_REQUEST", "Missing email/password");
    }

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !user.isActive) {
      return jsonError(401, "INVALID_CREDENTIALS", "Invalid credentials");
    }

    const ok = await bcrypt.compare(body.password, user.password);
    if (!ok) return jsonError(401, "INVALID_CREDENTIALS", "Invalid credentials");

    const accessToken = jwt.sign(
      { sub: user.id, role: user.role, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    return NextResponse.json({
      token: accessToken,
      accessToken,
      tokenType: "Bearer",
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
