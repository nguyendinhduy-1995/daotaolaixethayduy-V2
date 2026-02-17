import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { requirePermissionRouteAuth } from "@/lib/route-auth";
import { parsePermissionEntries } from "@/lib/permission-utils";

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

    return NextResponse.json({
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        isSystem: group.isSystem,
      },
      rules: group.rules,
    });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}

export async function PUT(req: Request, context: RouteContext) {
  const auth = await requirePermissionRouteAuth(req, { module: "admin_users", action: "UPDATE" });
  if (auth.error) return auth.error;

  try {
    const { id } = await Promise.resolve(context.params);
    const group = await prisma.permissionGroup.findUnique({ where: { id }, select: { id: true } });
    if (!group) return jsonError(404, "NOT_FOUND", "Không tìm thấy nhóm quyền");

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);

    const rules = parsePermissionEntries((body as Record<string, unknown>).rules);

    await prisma.$transaction(async (tx) => {
      const keepKeys = rules.map((rule) => ({ groupId: id, module: rule.module, action: rule.action }));

      if (keepKeys.length > 0) {
        await tx.permissionRule.deleteMany({
          where: {
            groupId: id,
            NOT: {
              OR: keepKeys,
            },
          },
        });
      } else {
        await tx.permissionRule.deleteMany({ where: { groupId: id } });
      }

      for (const rule of rules) {
        await tx.permissionRule.upsert({
          where: {
            groupId_module_action: {
              groupId: id,
              module: rule.module,
              action: rule.action,
            },
          },
          create: {
            groupId: id,
            module: rule.module,
            action: rule.action,
            allowed: rule.allowed,
          },
          update: { allowed: rule.allowed },
        });
      }
    });

    const updated = await prisma.permissionRule.findMany({
      where: { groupId: id },
      orderBy: [{ module: "asc" }, { action: "asc" }],
    });

    return NextResponse.json({ rules: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_RULES") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}
