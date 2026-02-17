/**
 * Seed Tuition Plans
 *
 * Usage: npx tsx scripts/seed-tuition-plans.ts
 * Or:    npm run seed:tuition
 *
 * Idempotent – safe to run multiple times (upsert).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PLANS = [
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

async function main() {
    console.log("🌱 Seeding tuition plans...");
    let seeded = 0;

    for (const p of PLANS) {
        await prisma.tuitionPlan.upsert({
            where: {
                province_licenseType: {
                    province: p.province,
                    licenseType: p.licenseType,
                },
            },
            update: { tuition: p.tuition, isActive: true },
            create: { ...p, isActive: true },
        });
        seeded++;
    }

    console.log(`✅ Seeded ${seeded} tuition plans (${PLANS.length} total)`);
}

main()
    .catch((e) => {
        console.error("❌ Seed failed:", e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
