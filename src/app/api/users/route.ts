import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import type { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { API_ERROR_VI } from "@/lib/api-error-vi";
import { requirePermissionRouteAuth } from "@/lib/route-auth";

const ROLES: Role[] = ["admin", "manager", "telesales", "direct_page", "viewer"];

function slugUsername(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);
}

async function resolveUniqueUsername(preferred: string) {
  const base = slugUsername(preferred) || `user_${Date.now()}`;
  let candidate = base;
  let n = 1;
  while (true) {
    const exists = await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!exists) return candidate;
    n += 1;
    candidate = `${base}_${n}`;
  }
}

function parsePositiveInt(value: string | null, fallback: number, max = 100) {
  if (value === null) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error("INVALID_PAGINATION");
  return Math.min(n, max);
}

function parseBooleanFilter(value: string | null) {
  if (value === null) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error("INVALID_BOOLEAN");
}

function isRole(value: unknown): value is Role {
  return typeof value === "string" && ROLES.includes(value as Role);
}

export async function GET(req: Request) {
  const authResult = await requirePermissionRouteAuth(req, { module: "admin_users", action: "VIEW" });
  if (authResult.error) return authResult.error;

  try {
    const { searchParams } = new URL(req.url);
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const pageSize = parsePositiveInt(searchParams.get("pageSize"), 20);
    const q = searchParams.get("q")?.trim();
    const role = searchParams.get("role");
    const isActive = parseBooleanFilter(searchParams.get("isActive"));
    const branchId = searchParams.get("branchId")?.trim();

    if (role !== null && !isRole(role)) {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }

    const where: Prisma.UserWhereInput = {
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { username: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(role ? { role } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(branchId ? { branchId } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          role: true,
          isActive: true,
          branchId: true,
          branch: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({ items, page, pageSize, total });
  } catch (error) {
    if (error instanceof Error && (error.message === "INVALID_PAGINATION" || error.message === "INVALID_BOOLEAN")) {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}

export async function POST(req: Request) {
  const authResult = await requirePermissionRouteAuth(req, { module: "admin_users", action: "CREATE" });
  if (authResult.error) return authResult.error;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    if (!body.email || typeof body.email !== "string") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    if (!body.password || typeof body.password !== "string" || body.password.length < 8) {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    if (!isRole(body.role)) {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }
    if (body.branchId !== undefined && body.branchId !== null && typeof body.branchId !== "string") {
      return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }

    const branchId =
      typeof body.branchId === "string" && body.branchId.trim().length > 0 ? body.branchId.trim() : null;
    if (branchId) {
      const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true } });
      if (!branch) return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    }

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) return jsonError(400, "VALIDATION_ERROR", API_ERROR_VI.required);
    const usernameInput =
      typeof body.username === "string" && body.username.trim().length > 0
        ? body.username
        : typeof body.name === "string" && body.name.trim().length > 0
          ? body.name
          : body.email.split("@")[0];
    const username = await resolveUniqueUsername(usernameInput);

    const passwordHash = await bcrypt.hash(body.password, 10);

    const user = await prisma.user.create({
      data: {
        name: typeof body.name === "string" ? body.name : null,
        username,
        email: body.email,
        password: passwordHash,
        role: body.role,
        isActive: typeof body.isActive === "boolean" ? body.isActive : true,
        branchId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
        branchId: true,
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ user });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", API_ERROR_VI.internal);
  }
}
