import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { requirePermissionRouteAuth } from "@/lib/route-auth";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

export async function GET(req: Request, context: RouteContext) {
  const auth = await requirePermissionRouteAuth(req, { module: "admin_users", action: "VIEW" });
  if (auth.error) return auth.error;

  try {
    const { id } = await Promise.resolve(context.params);
    const group = await prisma.permissionGroup.findUnique({
      where: { id },
      include: {
        rules: {
          orderBy: [{ module: "asc" }, { action: "asc" }],
        },
      },
    });
    if (!group) return jsonError(404, "NOT_FOUND", "Không tìm thấy nhóm quyền");
    return NextResponse.json({ group });
  } catch (err) {
    console.error("[admin.permission-groups.[id]]", err);
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  const auth = await requirePermissionRouteAuth(req, { module: "admin_users", action: "UPDATE" });
  if (auth.error) return auth.error;

  try {
    const { id } = await Promise.resolve(context.params);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }

    const existing = await prisma.permissionGroup.findUnique({ where: { id } });
    if (!existing) return jsonError(404, "NOT_FOUND", "Không tìm thấy nhóm quyền");

    const name = body.name === undefined ? undefined : typeof body.name === "string" ? body.name.trim() : "";
    if (body.name !== undefined && !name) {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }

    const group = await prisma.permissionGroup.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(body.description !== undefined
          ? { description: typeof body.description === "string" ? body.description.trim() : null }
          : {}),
        ...(body.isSystem !== undefined && typeof body.isSystem === "boolean" ? { isSystem: body.isSystem } : {}),
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

export async function DELETE(req: Request, context: RouteContext) {
  const auth = await requirePermissionRouteAuth(req, { module: "admin_users", action: "DELETE" });
  if (auth.error) return auth.error;

  try {
    const { id } = await Promise.resolve(context.params);
    const existing = await prisma.permissionGroup.findUnique({ where: { id }, select: { id: true, isSystem: true } });
    if (!existing) return jsonError(404, "NOT_FOUND", "Không tìm thấy nhóm quyền");
    if (existing.isSystem) return jsonError(400, "VALIDATION_ERROR", "Không thể xóa nhóm quyền hệ thống");

    await prisma.$transaction([
      prisma.user.updateMany({ where: { groupId: id }, data: { groupId: null } }),
      prisma.permissionGroup.delete({ where: { id } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin.permission-groups.[id]]", err);
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}
