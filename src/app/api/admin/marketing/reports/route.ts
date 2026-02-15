import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { requireAdminRole } from "@/lib/admin-auth";
import { requireRouteAuth } from "@/lib/route-auth";
import { listReports } from "@/lib/services/marketing";

function isDateYmd(value: string | null) {
  if (!value) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(req: Request) {
  const auth = requireRouteAuth(req);
  if (auth.error) return auth.error;
  const adminError = requireAdminRole(auth.auth.role);
  if (adminError) return adminError;

  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const branchId = searchParams.get("branchId") || undefined;
    const source = searchParams.get("source") || undefined;

    if (!isDateYmd(from) || !isDateYmd(to)) {
      return jsonError(400, "VALIDATION_ERROR", "from/to phải theo YYYY-MM-DD");
    }

    const payload = await listReports({
      from: from || undefined,
      to: to || undefined,
      branchId,
      source,
    });

    return NextResponse.json(payload);
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
