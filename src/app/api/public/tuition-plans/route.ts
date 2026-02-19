import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/public/tuition-plans
 * Public endpoint – no auth required.
 * Query params: ?province=... &licenseType=...
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const province = searchParams.get("province")?.trim() || undefined;
    const licenseType = searchParams.get("licenseType")?.trim() || undefined;

    try {
        const items = await prisma.tuitionPlan.findMany({
            where: {
                isActive: true,
                ...(province ? { province: { equals: province, mode: "insensitive" as const } } : {}),
                ...(licenseType ? { licenseType: { equals: licenseType, mode: "insensitive" as const } } : {}),
            },
            orderBy: [{ province: "asc" }, { tuition: "asc" }],
            select: { id: true, province: true, licenseType: true, tuition: true },
        });

        return NextResponse.json(
            {
                items: items.map((p) => ({
                    id: p.id,
                    province: p.province,
                    licenseType: p.licenseType,
                    tuition: p.tuition,
                    tuitionFormatted: new Intl.NumberFormat("vi-VN").format(p.tuition),
                })),
            },
            { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
        );
    } catch (err) {
        console.error("[tuition-plans] DB error:", (err as Error).message);
        return NextResponse.json({ items: [] }, { status: 500 });
    }
}
