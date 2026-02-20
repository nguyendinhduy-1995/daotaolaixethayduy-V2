import "dotenv/config";
import bcrypt from "bcrypt";
import { prisma } from "./scripts/prisma";

async function main() {
    const branches = await prisma.branch.findMany({ take: 1 });
    let branchId: string;
    if (branches.length > 0) {
        branchId = branches[0].id;
    } else {
        const b = await prisma.branch.create({ data: { name: "Chi nhánh chính" } });
        branchId = b.id;
        console.log("Created branch:", b.id);
    }

    const lead = await prisma.lead.upsert({
        where: { phone: "0948742666" },
        update: {},
        create: { fullName: "Học viên Test", phone: "0948742666", source: "manual", channel: "manual", status: "SIGNED", branchId },
    });
    console.log("Lead:", lead.id);

    let student = await prisma.student.findUnique({ where: { leadId: lead.id } });
    if (!student) {
        student = await prisma.student.create({ data: { leadId: lead.id, branchId } });
        console.log("Created student:", student.id);
    } else {
        console.log("Student exists:", student.id);
    }

    const hash = await bcrypt.hash("123456", 10);
    await prisma.studentAccount.upsert({
        where: { studentId: student.id },
        update: { passwordHash: hash, phone: "0948742666" },
        create: { phone: "0948742666", passwordHash: hash, studentId: student.id },
    });

    console.log("");
    console.log("=== Student Login ===");
    console.log("Phone: 0948742666");
    console.log("Password: 123456");

    await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
