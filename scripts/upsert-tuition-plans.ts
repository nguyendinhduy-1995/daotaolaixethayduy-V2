import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const PLANS = [
    // ── Vĩnh Long ──
    { province: "Vĩnh Long", licenseType: "B (số tự động)", tuition: 16_000_000 },
    { province: "Vĩnh Long", licenseType: "B (số sàn)", tuition: 16_000_000 },
    { province: "Vĩnh Long", licenseType: "C1", tuition: 19_000_000 },
    { province: "Vĩnh Long", licenseType: "B, C1, C lên D1", tuition: 14_000_000 },
    { province: "Vĩnh Long", licenseType: "B, C1, C, D1 lên D2", tuition: 15_000_000 },
    { province: "Vĩnh Long", licenseType: "C, D1, D2 lên D", tuition: 15_000_000 },
    { province: "Vĩnh Long", licenseType: "B lên C", tuition: 11_000_000 },
    { province: "Vĩnh Long", licenseType: "C1 lên C", tuition: 11_000_000 },
    { province: "Vĩnh Long", licenseType: "C lên CE", tuition: 17_000_000 },

    // ── Sóc Trăng ──
    { province: "Sóc Trăng", licenseType: "B (số tự động)", tuition: 16_000_000 },
    { province: "Sóc Trăng", licenseType: "B (số sàn)", tuition: 16_000_000 },
    { province: "Sóc Trăng", licenseType: "C1", tuition: 19_000_000 },
    { province: "Sóc Trăng", licenseType: "B, C1, C lên D1", tuition: 14_000_000 },
    { province: "Sóc Trăng", licenseType: "B, C1, C, D1 lên D2", tuition: 15_000_000 },
    { province: "Sóc Trăng", licenseType: "C, D1, D2 lên D", tuition: 15_000_000 },
    { province: "Sóc Trăng", licenseType: "B lên C", tuition: 11_000_000 },
    { province: "Sóc Trăng", licenseType: "C1 lên C", tuition: 11_000_000 },
    { province: "Sóc Trăng", licenseType: "C lên CE", tuition: 17_000_000 },

    // ── Cần Thơ ──
    { province: "Cần Thơ", licenseType: "B (số tự động)", tuition: 16_000_000 },
    { province: "Cần Thơ", licenseType: "B (số sàn)", tuition: 16_000_000 },
    { province: "Cần Thơ", licenseType: "C1", tuition: 19_000_000 },
    { province: "Cần Thơ", licenseType: "B, C1, C lên D1", tuition: 14_000_000 },
    { province: "Cần Thơ", licenseType: "B, C1, C, D1 lên D2", tuition: 15_000_000 },
    { province: "Cần Thơ", licenseType: "C, D1, D2 lên D", tuition: 15_000_000 },
    { province: "Cần Thơ", licenseType: "B lên C", tuition: 11_000_000 },
    { province: "Cần Thơ", licenseType: "C1 lên C", tuition: 11_000_000 },
    { province: "Cần Thơ", licenseType: "C lên CE", tuition: 17_000_000 },

    // ── Tiền Giang ──
    { province: "Tiền Giang", licenseType: "B (số tự động)", tuition: 20_000_000 },
    { province: "Tiền Giang", licenseType: "B (số sàn)", tuition: 19_000_000 },
    { province: "Tiền Giang", licenseType: "C1", tuition: 21_500_000 },
    { province: "Tiền Giang", licenseType: "B, C1, C lên D1", tuition: 14_000_000 },
    { province: "Tiền Giang", licenseType: "B, C1, C, D1 lên D2", tuition: 15_000_000 },
    { province: "Tiền Giang", licenseType: "C, D1, D2 lên D", tuition: 15_000_000 },
    { province: "Tiền Giang", licenseType: "B lên C", tuition: 11_000_000 },
    { province: "Tiền Giang", licenseType: "C1 lên C", tuition: 11_000_000 },
    { province: "Tiền Giang", licenseType: "C lên CE", tuition: 17_000_000 },

    // ── Hồ Chí Minh ──
    { province: "Hồ Chí Minh", licenseType: "B (số tự động)", tuition: 20_500_000 },
    { province: "Hồ Chí Minh", licenseType: "B (số sàn)", tuition: 19_500_000 },
    { province: "Hồ Chí Minh", licenseType: "C1", tuition: 22_500_000 },
    { province: "Hồ Chí Minh", licenseType: "B, C1, C lên D1", tuition: 14_000_000 },
    { province: "Hồ Chí Minh", licenseType: "B, C1, C, D1 lên D2", tuition: 15_000_000 },
    { province: "Hồ Chí Minh", licenseType: "C, D1, D2 lên D", tuition: 15_000_000 },
    { province: "Hồ Chí Minh", licenseType: "B lên C", tuition: 11_000_000 },
    { province: "Hồ Chí Minh", licenseType: "C1 lên C", tuition: 11_000_000 },
    { province: "Hồ Chí Minh", licenseType: "C lên CE", tuition: 17_000_000 },

    // ── Bình Dương ──
    { province: "Bình Dương", licenseType: "B (số tự động)", tuition: 20_500_000 },
    { province: "Bình Dương", licenseType: "B (số sàn)", tuition: 19_500_000 },
    { province: "Bình Dương", licenseType: "C1", tuition: 22_500_000 },
    { province: "Bình Dương", licenseType: "B, C1, C lên D1", tuition: 14_000_000 },
    { province: "Bình Dương", licenseType: "B, C1, C, D1 lên D2", tuition: 15_000_000 },
    { province: "Bình Dương", licenseType: "C, D1, D2 lên D", tuition: 15_000_000 },
    { province: "Bình Dương", licenseType: "B lên C", tuition: 11_000_000 },
    { province: "Bình Dương", licenseType: "C1 lên C", tuition: 11_000_000 },
    { province: "Bình Dương", licenseType: "C lên CE", tuition: 17_000_000 },

    // ── Đồng Nai ──
    { province: "Đồng Nai", licenseType: "B (số tự động)", tuition: 20_500_000 },
    { province: "Đồng Nai", licenseType: "B (số sàn)", tuition: 19_500_000 },
    { province: "Đồng Nai", licenseType: "C1", tuition: 22_500_000 },
    { province: "Đồng Nai", licenseType: "B, C1, C lên D1", tuition: 14_000_000 },
    { province: "Đồng Nai", licenseType: "B, C1, C, D1 lên D2", tuition: 15_000_000 },
    { province: "Đồng Nai", licenseType: "C, D1, D2 lên D", tuition: 15_000_000 },
    { province: "Đồng Nai", licenseType: "B lên C", tuition: 11_000_000 },
    { province: "Đồng Nai", licenseType: "C1 lên C", tuition: 11_000_000 },
    { province: "Đồng Nai", licenseType: "C lên CE", tuition: 17_000_000 },
];

async function main() {
    console.log(`Upserting ${PLANS.length} tuition plans...`);
    let created = 0;
    let updated = 0;

    for (const plan of PLANS) {
        const result = await prisma.tuitionPlan.upsert({
            where: {
                province_licenseType: {
                    province: plan.province,
                    licenseType: plan.licenseType,
                },
            },
            create: {
                province: plan.province,
                licenseType: plan.licenseType,
                tuition: plan.tuition,
                isActive: true,
            },
            update: {
                tuition: plan.tuition,
                isActive: true,
            },
        });

        const isNew = result.createdAt.getTime() === result.updatedAt.getTime();
        if (isNew) created++;
        else updated++;

        console.log(
            `  ${isNew ? "CREATE" : "UPDATE"} ${plan.province} / ${plan.licenseType} = ${(plan.tuition / 1_000_000).toFixed(1)}M`
        );
    }

    console.log(`\nDone: ${created} created, ${updated} updated, ${PLANS.length} total.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
