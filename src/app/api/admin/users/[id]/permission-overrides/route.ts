import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { requirePermissionRouteAuth } from "@/lib/route-auth";
import { parsePermissionEntries } from "@/lib/permission-utils";
import { getEffectivePermissions, serializePermissions } from "@/lib/permissions";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

export async function GET(req: Request, context: RouteContext) {
  const auth = await requirePermissionRouteAuth(req, { module: "admin_users", action: "VIEW" });
  if (auth.error) return auth.error;

  try {
    const { id } = await Promise.resolve(context.params);
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        groupId: true,
        permissionGroup: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        permissionOverrides: {
          orderBy: [{ module: "asc" }, { action: "asc" }],
        },
      },
    });

    if (!user) return jsonError(404, "NOT_FOUND", "Không tìm thấy người dùng");

    const effectivePermissions = await getEffectivePermissions({ sub: user.id, role: user.role });

    return NextResponse.json({
      user,
      overrides: user.permissionOverrides,
      effectivePermissions: serializePermissions(effectivePermissions),
    });
  } catch (err) {
    console.error("[admin.users.[id].permission-overrides]", err);
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}

export async function PUT(req: Request, context: RouteContext) {
  const auth = await requirePermissionRouteAuth(req, { module: "admin_users", action: "UPDATE" });
  if (auth.error) return auth.error;

  try {
    const { id } = await Promise.resolve(context.params);
    const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!target) return jsonError(404, "NOT_FOUND", "Không tìm thấy người dùng");

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);

    const payload = body as Record<string, unknown>;
    const overrides = parsePermissionEntries(payload.overrides);

    await prisma.$transaction(async (tx) => {
      if (payload.groupId !== undefined) {
        if (payload.groupId === null) {
          await tx.user.update({ where: { id }, data: { groupId: null } });
        } else if (typeof payload.groupId === "string") {
          const group = await tx.permissionGroup.findUnique({ where: { id: payload.groupId }, select: { id: true } });
          if (!group) throw new Error("INVALID_GROUP");
          await tx.user.update({ where: { id }, data: { groupId: payload.groupId } });
        } else {
          throw new Error("INVALID_GROUP");
        }
      }

      const keepKeys = overrides.map((rule) => ({ userId: id, module: rule.module, action: rule.action }));
      if (keepKeys.length > 0) {
        await tx.userPermissionOverride.deleteMany({
          where: {
            userId: id,
            NOT: {
              OR: keepKeys,
            },
          },
        });
      } else {
        await tx.userPermissionOverride.deleteMany({ where: { userId: id } });
      }

      for (const rule of overrides) {
        await tx.userPermissionOverride.upsert({
          where: {
            userId_module_action: {
              userId: id,
              module: rule.module,
              action: rule.action,
            },
          },
          create: {
            userId: id,
            module: rule.module,
            action: rule.action,
            allowed: rule.allowed,
          },
          update: { allowed: rule.allowed },
        });
      }
    });

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        groupId: true,
        permissionGroup: {
          select: { id: true, name: true, description: true },
        },
        permissionOverrides: { orderBy: [{ module: "asc" }, { action: "asc" }] },
      },
    });

    if (!user) return jsonError(404, "NOT_FOUND", "Không tìm thấy người dùng");

    const effectivePermissions = await getEffectivePermissions({ sub: user.id, role: user.role });

    return NextResponse.json({
      user,
      overrides: user.permissionOverrides,
      effectivePermissions: serializePermissions(effectivePermissions),
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "INVALID_RULES" || error.message === "INVALID_GROUP")) {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}
