import { NextResponse } from "next/server";

type ErrorBody = {
  ok: false;
  error: {
    code: string;
    message?: string;
  };
};

export function jsonError(status: number, code: string, message?: string) {
  return NextResponse.json<ErrorBody>(
    { ok: false, error: { code, ...(message ? { message } : {}) } },
    { status }
  );
}
