import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";

const ALLOWED_SOURCE_TYPES = new Set(["RECEIPT", "LEAD", "STUDENT", "MANUAL_ADJUST", "PAID50"]);

function parsePositiveInt(value: string | null, fallback: number, max = 100) {
  if (value === null) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error("INVALID_PAGINATION");
  return Math.min(n, max);
}

export async function GET(req: Request) {
  const auth = await requireMappedRoutePermissionAuth(req);
  if (auth.error) return auth.error;
  const adminError = requireAdminRole(auth.auth.role);
  if (adminError) return adminError;

  try {
    const { searchParams } = new URL(req.url);
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const pageSize = parsePositiveInt(searchParams.get("pageSize"), 20);
    const month = searchParams.get("month") || undefined;
    const branchId = searchParams.get("branchId") || undefined;
    const userId = searchParams.get("userId") || undefined;

    const where = {
      ...(month ? { periodMonth: month } : {}),
      ...(branchId ? { branchId } : {}),
      ...(userId ? { userId } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.commissionLedger.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          branch: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.commissionLedger.count({ where }),
    ]);

    return NextResponse.json({ items, page, pageSize, total });
  } catch (err) {
    console.error("[admin.commissions]", err);
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}

export async function POST(req: Request) {
  const auth = await requireMappedRoutePermissionAuth(req);
  if (auth.error) return auth.error;
  const adminError = requireAdminRole(auth.auth.role);
  if (adminError) return adminError;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return jsonError(400, "VALIDATION_ERROR", "Invalid JSON body");

    const userId = typeof body.userId === "string" ? body.userId : "";
    const branchId = typeof body.branchId === "string" ? body.branchId : "";
    const periodMonth = typeof body.periodMonth === "string" ? body.periodMonth : "";
    const sourceType = typeof body.sourceType === "string" ? body.sourceType.toUpperCase() : "MANUAL_ADJUST";
    const amountBaseVnd = Number(body.amountBaseVnd);
    const commissionVnd = Number(body.commissionVnd);

    if (
      !userId ||
      !branchId ||
      !/^\d{4}-\d{2}$/.test(periodMonth) ||
      !Number.isInteger(amountBaseVnd) ||
      !Number.isInteger(commissionVnd) ||
      !ALLOWED_SOURCE_TYPES.has(sourceType)
    ) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid payload");
    }

    const commission = await prisma.commissionLedger.create({
      data: {
        userId,
        branchId,
        periodMonth,
        sourceType: sourceType as never,
        sourceId: typeof body.sourceId === "string" ? body.sourceId : null,
        studentId: typeof body.studentId === "string" ? body.studentId : null,
        amountBaseVnd,
        commissionVnd,
        note: typeof body.note === "string" ? body.note : null,
        metaJson: body.metaJson && typeof body.metaJson === "object" ? body.metaJson : null,
      },
    });

    return NextResponse.json({ commission });
  } catch (err) {
    console.error("[admin.commissions]", err);
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
