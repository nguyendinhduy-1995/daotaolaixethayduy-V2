import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";

/* ── Auto-seed data ── */
const SEED_PLANS = [
    { province: "TPHCM", licenseType: "B1", tuition: 6500000 },
    { province: "TPHCM", licenseType: "B2", tuition: 8500000 },
    { province: "TPHCM", licenseType: "C", tuition: 12000000 },
    { province: "Đồng Nai", licenseType: "B1", tuition: 6100000 },
    { province: "Đồng Nai", licenseType: "B2", tuition: 8100000 },
    { province: "Đồng Nai", licenseType: "C", tuition: 11500000 },
    { province: "Tây Ninh", licenseType: "B1", tuition: 5800000 },
    { province: "Tây Ninh", licenseType: "B2", tuition: 7800000 },
    { province: "Tây Ninh", licenseType: "C", tuition: 11000000 },
    { province: "Long An", licenseType: "B1", tuition: 5500000 },
    { province: "Long An", licenseType: "B2", tuition: 7500000 },
    { province: "Long An", licenseType: "C", tuition: 10500000 },
    { province: "Cần Thơ", licenseType: "B1", tuition: 5700000 },
    { province: "Cần Thơ", licenseType: "B2", tuition: 7700000 },
    { province: "Cần Thơ", licenseType: "C", tuition: 11000000 },
    { province: "Hậu Giang", licenseType: "B1", tuition: 5600000 },
    { province: "Hậu Giang", licenseType: "B2", tuition: 7600000 },
    { province: "Hậu Giang", licenseType: "C", tuition: 10800000 },
    { province: "Bạc Liêu", licenseType: "B1", tuition: 5500000 },
    { province: "Bạc Liêu", licenseType: "B2", tuition: 7500000 },
    { province: "Bạc Liêu", licenseType: "C", tuition: 10500000 },
    { province: "Tiền Giang", licenseType: "B1", tuition: 5800000 },
    { province: "Tiền Giang", licenseType: "B2", tuition: 7800000 },
    { province: "Tiền Giang", licenseType: "C", tuition: 11200000 },
    { province: "Vĩnh Long", licenseType: "B1", tuition: 5600000 },
    { province: "Vĩnh Long", licenseType: "B2", tuition: 7600000 },
    { province: "Vĩnh Long", licenseType: "C", tuition: 10800000 },
    { province: "Sóc Trăng", licenseType: "B1", tuition: 5500000 },
    { province: "Sóc Trăng", licenseType: "B2", tuition: 7500000 },
    { province: "Sóc Trăng", licenseType: "C", tuition: 10500000 },
];

let seedDone = false;

async function autoSeedIfEmpty() {
    if (seedDone) return;
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_AUTO_SEED !== "true") return;

    const count = await prisma.tuitionPlan.count();
    if (count > 0) {
        seedDone = true;
        return;
    }

    for (const p of SEED_PLANS) {
        await prisma.tuitionPlan.upsert({
            where: { province_licenseType: { province: p.province, licenseType: p.licenseType } },
            update: { tuition: p.tuition, isActive: true },
            create: { ...p, isActive: true },
        });
    }
    seedDone = true;
}

/**
 * GET /api/public/tuition-plans
 * Public endpoint – no auth required.
 * Tries DB first. Falls back to hardcoded SEED_PLANS when DB is unreachable.
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const province = searchParams.get("province")?.trim() || undefined;
    const licenseType = searchParams.get("licenseType")?.trim().toUpperCase() || undefined;

    // Attempt DB fetch
    try {
        await autoSeedIfEmpty();

        const items = await prisma.tuitionPlan.findMany({
            where: {
                isActive: true,
                ...(province ? { province: { equals: province, mode: "insensitive" as const } } : {}),
                ...(licenseType ? { licenseType: { equals: licenseType, mode: "insensitive" as const } } : {}),
            },
            orderBy: [{ province: "asc" }, { licenseType: "asc" }],
            select: { id: true, province: true, licenseType: true, tuition: true },
        });

        if (items.length > 0) {
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
        }
    } catch (err) {
        console.warn("[tuition-plans] DB unavailable, using fallback data:", (err as Error).message);
    }

    // Fallback: serve from hardcoded SEED_PLANS
    let fallback = SEED_PLANS;
    if (province) fallback = fallback.filter((p) => p.province.toLowerCase() === province.toLowerCase());
    if (licenseType) fallback = fallback.filter((p) => p.licenseType.toLowerCase() === licenseType.toLowerCase());

    return NextResponse.json(
        {
            items: fallback.map((p, idx) => ({
                id: `seed-${idx}`,
                province: p.province,
                licenseType: p.licenseType,
                tuition: p.tuition,
                tuitionFormatted: new Intl.NumberFormat("vi-VN").format(p.tuition),
            })),
        },
        { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
    );
}

