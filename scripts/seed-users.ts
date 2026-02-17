/**
 * Seed default admin + student accounts for testing.
 * Usage: npx tsx scripts/seed-users.ts
 */
import bcrypt from "bcrypt";
import { prisma } from "../src/lib/prisma";

async function main() {
    const PASSWORD = "Nguyendinhduy@95";
    const hash = await bcrypt.hash(PASSWORD, 10);

    // 1. Create default branch
    const branch = await prisma.branch.upsert({
        where: { code: "HQ" },
        update: {},
        create: {
            name: "Chi nhánh chính",
            code: "HQ",
            isActive: true,
        },
    });
    console.log("✓ Branch:", branch.name);

    // 2. Create admin user
    const admin = await prisma.user.upsert({
        where: { email: "nguyendinhduy@admin.local" },
        update: { passwordHash: hash },
        create: {
            email: "nguyendinhduy@admin.local",
            name: "Nguyễn Đình Duy",
            passwordHash: hash,
            role: "admin",
            isActive: true,
            branchId: branch.id,
        },
    });
    console.log("✓ Admin user:", admin.name, "(email:", admin.email + ")");

    // 3. Create a lead for the student
    const lead = await prisma.lead.upsert({
        where: { phone: "0902795323" },
        update: {},
        create: {
            fullName: "Học viên test",
            phone: "0902795323",
            province: "TPHCM",
            licenseType: "B2",
            source: "manual",
            channel: "manual",
            status: "HAS_PHONE",
            branchId: branch.id,
        },
    });
    console.log("✓ Lead:", lead.fullName, lead.phone);

    // 4. Create student linked to lead
    const student = await prisma.student.upsert({
        where: { leadId: lead.id },
        update: {},
        create: {
            leadId: lead.id,
            branchId: branch.id,
            status: "LEARNING",
            profileCode: "HV-001",
        },
    });
    console.log("✓ Student:", student.id, "(profileCode:", student.profileCode + ")");

    // 5. Create StudentAccount table if needed + account
    await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "StudentAccount" (
      "id"           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "phone"        TEXT UNIQUE NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "studentId"    TEXT UNIQUE NOT NULL,
      "createdAt"    TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"    TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
    )
  `);

    // Upsert student account
    const existingAccount = await prisma.studentAccount.findUnique({
        where: { phone: "0902795323" },
    });

    if (existingAccount) {
        await prisma.studentAccount.update({
            where: { id: existingAccount.id },
            data: { passwordHash: hash },
        });
        console.log("✓ Student account updated (phone: 0902795323)");
    } else {
        await prisma.studentAccount.create({
            data: {
                phone: "0902795323",
                passwordHash: hash,
                studentId: student.id,
            },
        });
        console.log("✓ Student account created (phone: 0902795323)");
    }

    console.log("\n=== Thông tin đăng nhập ===");
    console.log("Admin:   Nguyendinhduy / Nguyendinhduy@95   → /login");
    console.log("  (dùng email: nguyendinhduy@admin.local hoặc tên)");
    console.log("Student: 0902795323 / Nguyendinhduy@95      → /student/login");

    await prisma.$disconnect();
}

main().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
});
