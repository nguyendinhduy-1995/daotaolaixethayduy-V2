import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/public/seed-tuition
 * Temporary endpoint to seed tuition plan data.
 * Safe to call multiple times (upsert by province+licenseType).
 * DELETE this route after seeding in production.
 */
export async function POST() {
    try {
        const plans = [
            { province: "TPHCM", licenseType: "B1", tuition: 6500000 },
            { province: "TPHCM", licenseType: "B2", tuition: 8500000 },
            { province: "TPHCM", licenseType: "C", tuition: 12000000 },
            { province: "Hà Nội", licenseType: "B1", tuition: 6000000 },
            { province: "Hà Nội", licenseType: "B2", tuition: 8000000 },
            { province: "Hà Nội", licenseType: "C", tuition: 11500000 },
            { province: "Đà Nẵng", licenseType: "B1", tuition: 5800000 },
            { province: "Đà Nẵng", licenseType: "B2", tuition: 7800000 },
            { province: "Đà Nẵng", licenseType: "C", tuition: 11000000 },
            { province: "Bình Dương", licenseType: "B1", tuition: 6200000 },
            { province: "Bình Dương", licenseType: "B2", tuition: 8200000 },
            { province: "Bình Dương", licenseType: "C", tuition: 11800000 },
            { province: "Đồng Nai", licenseType: "B1", tuition: 6100000 },
            { province: "Đồng Nai", licenseType: "B2", tuition: 8100000 },
            { province: "Đồng Nai", licenseType: "C", tuition: 11500000 },
            { province: "Long An", licenseType: "B1", tuition: 5500000 },
            { province: "Long An", licenseType: "B2", tuition: 7500000 },
            { province: "Long An", licenseType: "C", tuition: 10500000 },
            { province: "Cần Thơ", licenseType: "B1", tuition: 5700000 },
            { province: "Cần Thơ", licenseType: "B2", tuition: 7700000 },
            { province: "Cần Thơ", licenseType: "C", tuition: 11000000 },
        ];

        let seeded = 0;
        for (const p of plans) {
            await prisma.tuitionPlan.upsert({
                where: {
                    province_licenseType: {
                        province: p.province,
                        licenseType: p.licenseType,
                    },
                },
                update: { tuition: p.tuition, isActive: true },
                create: {
                    province: p.province,
                    licenseType: p.licenseType,
                    tuition: p.tuition,
                    isActive: true,
                },
            });
            seeded++;
        }

        return NextResponse.json({
            ok: true,
            message: `Đã tạo ${seeded} gói học phí thành công`,
            count: seeded,
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown";
        return NextResponse.json(
            { ok: false, error: { code: "INTERNAL_ERROR", message: msg } },
            { status: 500 }
        );
    }
}
