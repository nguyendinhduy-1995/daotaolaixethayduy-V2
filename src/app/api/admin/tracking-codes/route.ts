import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";

const PLACEMENTS = ["HEAD", "BODY_TOP", "BODY_BOTTOM"] as const;
const SITES = ["GLOBAL", "LANDING", "CRM", "STUDENT", "TAPLAI"] as const;
const KEY_REGEX = /^[a-z0-9_]+$/;
const MAX_CODE_LENGTH = 50_000;

type Placement = (typeof PLACEMENTS)[number];
type Site = (typeof SITES)[number];

function isPlacement(v: unknown): v is Placement {
    return typeof v === "string" && (PLACEMENTS as readonly string[]).includes(v);
}
function isSite(v: unknown): v is Site {
    return typeof v === "string" && (SITES as readonly string[]).includes(v);
}

export async function GET(req: Request) {
    const authResult = await requireMappedRoutePermissionAuth(req);
    if (authResult.error) return authResult.error;
    const adminError = requireAdminRole(authResult.auth.role);
    if (adminError) return adminError;

    const url = new URL(req.url);
    const siteParam = url.searchParams.get("site") ?? "ALL";

    try {
        const where = siteParam === "ALL" ? {} : isSite(siteParam) ? { site: siteParam } : {};
        const items = await prisma.trackingCode.findMany({
            where,
            orderBy: { createdAt: "desc" },
        });
        return NextResponse.json({ items });
    } catch (err) {
        console.error("[admin.tracking-codes.GET]", err);
        return jsonError(500, "INTERNAL_ERROR", "Internal server error");
    }
}

export async function POST(req: Request) {
    const authResult = await requireMappedRoutePermissionAuth(req);
    if (authResult.error) return authResult.error;
    const adminError = requireAdminRole(authResult.auth.role);
    if (adminError) return adminError;

    try {
        const body = await req.json().catch(() => null);
        if (!body || typeof body !== "object") {
            return jsonError(400, "VALIDATION_ERROR", "Invalid JSON body");
        }

        const { site, key, name, placement, code, isEnabled } = body as Record<string, unknown>;

        if (site !== undefined && !isSite(site)) {
            return jsonError(400, "VALIDATION_ERROR", "site phải là GLOBAL, LANDING, CRM, STUDENT hoặc TAPLAI");
        }
        if (!key || typeof key !== "string" || !KEY_REGEX.test(key)) {
            return jsonError(400, "VALIDATION_ERROR", "key phải là chữ thường, số và dấu gạch dưới");
        }
        if (!name || typeof name !== "string") {
            return jsonError(400, "VALIDATION_ERROR", "name là bắt buộc");
        }
        if (!isPlacement(placement)) {
            return jsonError(400, "VALIDATION_ERROR", "placement phải là HEAD, BODY_TOP hoặc BODY_BOTTOM");
        }
        if (!code || typeof code !== "string") {
            return jsonError(400, "VALIDATION_ERROR", "code là bắt buộc");
        }
        if (code.length > MAX_CODE_LENGTH) {
            return jsonError(400, "VALIDATION_ERROR", `code không được vượt quá ${MAX_CODE_LENGTH} ký tự`);
        }

        const siteValue = (site as Site) || "GLOBAL";
        const existing = await prisma.trackingCode.findUnique({
            where: { site_key: { site: siteValue, key: key as string } },
        });
        if (existing) {
            return jsonError(409, "DUPLICATE_KEY", `Key "${key}" đã tồn tại cho site ${siteValue}`);
        }

        const item = await prisma.trackingCode.create({
            data: {
                site: siteValue,
                key: (key as string).trim(),
                name: (name as string).trim(),
                placement,
                code: code as string,
                isEnabled: typeof isEnabled === "boolean" ? isEnabled : true,
                updatedById: authResult.auth.sub,
            },
        });

        console.info(
            `[AUDIT] TrackingCode CREATED id=${item.id} site=${item.site} key=${item.key} by=${authResult.auth.sub} at=${new Date().toISOString()}`
        );

        return NextResponse.json({ item }, { status: 201 });
    } catch (err) {
        console.error("[admin.tracking-codes.POST]", err);
        return jsonError(500, "INTERNAL_ERROR", "Internal server error");
    }
}
