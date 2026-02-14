import type { NextResponse } from "next/server";
import { STUDENT_ACCESS_TOKEN_COOKIE } from "@/lib/jwt";

function isProd() {
  return process.env.NODE_ENV === "production";
}

export function setStudentAuthCookie(response: NextResponse, accessToken: string) {
  response.cookies.set(STUDENT_ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });
}

export function clearStudentAuthCookie(response: NextResponse) {
  response.cookies.set(STUDENT_ACCESS_TOKEN_COOKIE, "", {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
