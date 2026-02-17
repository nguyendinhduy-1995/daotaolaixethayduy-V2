import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { requirePermissionRouteAuth } from "@/lib/route-auth";

function parsePositiveInt(value: string | null, fallback: number, max = 100) {
  if (!value) return fallback;
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) throw new Error("INVALID_PAGINATION");
  return Math.min(num, max);
}

export async function GET(req: Request) {
  const auth = await requirePermissionRouteAuth(req, { module: "admin_users", action: "VIEW" });
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const pageSize = parsePositiveInt(searchParams.get("pageSize"), 20);
    const q = searchParams.get("q")?.trim();

    const where = q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { description: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      prisma.permissionGroup.findMany({
        where,
        include: {
          _count: {
            select: {
              rules: true,
              users: true,
            },
          },
        },
        orderBy: [{ isSystem: "desc" }, { name: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.permissionGroup.count({ where }),
    ]);

    return NextResponse.json({ items, page, pageSize, total });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_PAGINATION") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}

export async function POST(req: Request) {
  const auth = await requirePermissionRouteAuth(req, { module: "admin_users", action: "CREATE" });
  if (auth.error) return auth.error;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);

    const group = await prisma.permissionGroup.create({
      data: {
        name,
        description: typeof body.description === "string" ? body.description.trim() : null,
        isSystem: typeof body.isSystem === "boolean" ? body.isSystem : false,
      },
    });

    return NextResponse.json({ group });
  } catch (error) {
    if (error instanceof Error && error.message.includes("PermissionGroup_name_key")) {
      return jsonError(400, "VALIDATION_ERROR", "Tên nhóm quyền đã tồn tại");
    }
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}
