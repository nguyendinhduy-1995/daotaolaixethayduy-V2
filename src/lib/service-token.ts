import { jsonError } from "@/lib/api-response";

export function requireServiceToken(req: Request) {
  const expected = process.env.SERVICE_TOKEN?.trim();
  const provided = req.headers.get("x-service-token")?.trim();

  if (!provided) {
    return {
      token: null,
      error: jsonError(401, "AUTH_MISSING_SERVICE_TOKEN", "Thiếu token dịch vụ"),
    };
  }

  if (!expected) {
    return {
      token: null,
      error: jsonError(500, "INTERNAL_ERROR", "Thiếu cấu hình SERVICE_TOKEN"),
    };
  }

  if (provided !== expected) {
    return {
      token: null,
      error: jsonError(401, "AUTH_INVALID_SERVICE_TOKEN", "Token dịch vụ không hợp lệ"),
    };
  }

  return { token: provided, error: null };
}

