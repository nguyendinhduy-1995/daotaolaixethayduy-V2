import { NextResponse } from "next/server";
import { clearStudentAuthCookie } from "@/lib/student-auth-cookies";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearStudentAuthCookie(response);
  return response;
}
