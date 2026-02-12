import { NextResponse } from "next/server";

type ErrorBody = {
  error: {
    code: string;
    message: string;
  };
};

export function jsonError(status: number, code: string, message: string) {
  return NextResponse.json<ErrorBody>({ error: { code, message } }, { status });
}
