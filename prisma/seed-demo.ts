/**
 * Demo Seed Script — creates realistic demo data for QA testing.
 * Run: npx tsx prisma/seed-demo.ts
 *
 * Idempotent: finds existing entities or creates new ones.
 * Does NOT touch existing production data — demo entities use "demo-" prefix IDs.
 */
import "dotenv/config";
import { PrismaClient, type LeadStatus, type LeadEventType, type ReceiptMethod } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcrypt";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const PASSWORD = "Admin@123456";

// ─── Dynamic IDs (resolved at runtime) ─────────────────────────────
const R = {
    branchQ1: "",
    admin: "",
    page1: "",
    telesale1: "",
    finance1: "",
    planB2: "",
};

// ─── Helpers ────────────────────────────────────────────────────────
function daysAgo(n: number) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(8 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), 0, 0);
    return d;
}

function hoursAfter(base: Date, h: number) {
    return new Date(base.getTime() + h * 3600_000 + Math.floor(Math.random() * 1800_000));
}

function leadId(n: number) {
    return `demo-lead-${String(n).padStart(3, "0")}`;
}

function studentId(n: number) {
    return `demo-student-${String(n).padStart(3, "0")}`;
}

function randomPhone() {
    return `09${Math.floor(10_000_000 + Math.random() * 90_000_000)}`;
}

const FIRST_NAMES = [
    "Nguyễn Văn", "Trần Thị", "Lê Hoàng", "Phạm Minh", "Võ Thanh",
    "Đỗ Ngọc", "Bùi Xuân", "Hoàng Thị", "Huỳnh Đức", "Ngô Bảo",
    "Đặng Quốc", "Vũ Thị", "Phan Anh", "Lý Hồng", "Dương Thanh",
    "Mai Thị", "Tạ Minh", "Hồ Xuân", "Đinh Văn", "Lương Thị",
    "Trịnh Quang", "Cao Thị", "Châu Minh", "Tô Thanh", "La Thị",
    "Thái Văn", "Kiều Thị", "Quách Minh", "Lưu Thanh", "Tăng Thị",
    "Nghiêm Văn", "Mạc Thị", "Từ Minh", "Hà Thanh", "Ông Thị",
    "Đoàn Văn", "Khương Thị", "Tiêu Minh", "Lục Thanh", "Diệp Thị",
];
const LAST_NAMES = [
    "An", "Bình", "Cường", "Dũng", "Em", "Phúc", "Giang", "Hải",
    "Khoa", "Long", "Minh", "Nam", "Oanh", "Phong", "Quân",
    "Sơn", "Tùng", "Uyên", "Vân", "Xuân", "Yến", "Đạt",
    "Huy", "Kiên", "Linh", "Nhung", "Nga", "Hoa", "Trang", "Đức",
    "Thắng", "Tú", "Hằng", "Lan", "Mai", "Tuấn", "Hạnh", "Thư", "Hiếu", "Ngọc",
];

function randomName(i: number) {
    return `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[i % LAST_NAMES.length]}`;
}

const PROVINCES = ["Hồ Chí Minh", "Bình Dương", "Đồng Nai", "Long An", "Tây Ninh"];
const SOURCES = ["facebook", "zalo", "tiktok", "website", "walk_in", "referral"];
const CHANNELS = ["messenger", "zalo_oa", "phone", "direct"];

// ─── Lead specs ─────────────────────────────────────────────────────
interface LeadSpec {
    status: LeadStatus;
    events: LeadEventType[];
}

function buildLeadSpecs(): LeadSpec[] {
    const specs: LeadSpec[] = [];
    for (let i = 0; i < 10; i++) specs.push({ status: "NEW", events: ["NEW"] });
    for (let i = 0; i < 10; i++) specs.push({ status: "HAS_PHONE", events: ["NEW", "HAS_PHONE", "CALLED"] });
    for (let i = 0; i < 8; i++) specs.push({ status: "APPOINTED", events: ["NEW", "HAS_PHONE", "CALLED", "APPOINTED"] });
    for (let i = 0; i < 6; i++) specs.push({ status: "ARRIVED", events: ["NEW", "HAS_PHONE", "CALLED", "APPOINTED", "ARRIVED"] });
    for (let i = 0; i < 4; i++) specs.push({ status: "SIGNED", events: ["NEW", "HAS_PHONE", "CALLED", "APPOINTED", "ARRIVED", "SIGNED"] });
    for (let i = 0; i < 2; i++) specs.push({ status: "LOST", events: ["NEW", "HAS_PHONE", "CALLED", "LOST"] });
    return specs;
}

// ─── Find or create helper ──────────────────────────────────────────
async function findOrCreateBranch(code: string, name: string): Promise<string> {
    const existing = await prisma.branch.findFirst({ where: { code } });
    if (existing) { console.log(`  ✓ Branch ${code} exists (${existing.id})`); return existing.id; }
    const created = await prisma.branch.create({ data: { code, name } });
    console.log(`  + Branch ${code} created (${created.id})`);
    return created.id;
}

async function findOrCreateUser(
    username: string, email: string, name: string, role: "admin" | "direct_page" | "telesales" | "viewer", hash: string, branchId: string,
): Promise<string> {
    const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
    if (existing) {
        await prisma.user.update({ where: { id: existing.id }, data: { name, role, password: hash, branchId } });
        console.log(`  ✓ ${email} updated (${existing.id})`);
        return existing.id;
    }
    const created = await prisma.user.create({ data: { username, email, name, role, password: hash, branchId } });
    console.log(`  + ${email} created (${created.id})`);
    return created.id;
}

// ─── Main ───────────────────────────────────────────────────────────
async function main() {
    console.log("🌱 Seeding demo data...\n");

    // ── 1. Branches ─────────────────────────────────────────────────
    console.log("📍 Ensuring branches...");
    R.branchQ1 = await findOrCreateBranch("Q1", "Chi nhánh Quận 1");
    await findOrCreateBranch("BT", "Chi nhánh Bình Thạnh");
    await findOrCreateBranch("TD", "Chi nhánh Thủ Đức");
    console.log("");

    // ── 2. Users ────────────────────────────────────────────────────
    console.log("👤 Creating demo users...");
    const hash = await bcrypt.hash(PASSWORD, 10);
    R.admin = await findOrCreateUser("admin_demo", "admin@thayduy.local", "Admin Demo", "admin", hash, R.branchQ1);
    R.page1 = await findOrCreateUser("page1", "page1@thayduy.local", "Trực Page Demo", "direct_page", hash, R.branchQ1);
    R.telesale1 = await findOrCreateUser("telesale1", "telesale1@thayduy.local", "Telesale Demo", "telesales", hash, R.branchQ1);
    R.finance1 = await findOrCreateUser("finance1", "finance1@thayduy.local", "Kế toán Demo", "viewer", hash, R.branchQ1);
    console.log(`  ✅ 4 users (password: ${PASSWORD})\n`);

    // ── 3. TuitionPlan ──────────────────────────────────────────────
    console.log("💰 Ensuring tuition plan...");
    const existingPlan = await prisma.tuitionPlan.findFirst({ where: { province: "Hồ Chí Minh", licenseType: "B2" } });
    if (existingPlan) {
        R.planB2 = existingPlan.id;
        console.log(`  ✓ Plan B2/HCM exists (${existingPlan.id})`);
    } else {
        const plan = await prisma.tuitionPlan.create({ data: { province: "Hồ Chí Minh", licenseType: "B2", tuition: 12_000_000 } });
        R.planB2 = plan.id;
        console.log(`  + Plan B2/HCM created (${plan.id})`);
    }
    console.log("");

    // ── 4. Clean old demo data ──────────────────────────────────────
    console.log("🧹 Cleaning old demo leads/students/receipts...");
    await prisma.receipt.deleteMany({ where: { student: { id: { startsWith: "demo-student-" } } } });
    await prisma.student.deleteMany({ where: { id: { startsWith: "demo-student-" } } });
    await prisma.leadEvent.deleteMany({ where: { lead: { id: { startsWith: "demo-lead-" } } } });
    await prisma.lead.deleteMany({ where: { id: { startsWith: "demo-lead-" } } });
    console.log("  ✅ Old demo data cleaned\n");

    // ── 5. Leads + Events ──────────────────────────────────────────
    console.log("📋 Creating leads & events...");
    const specs = buildLeadSpecs();
    const owners = [R.telesale1, R.page1];
    let eventCount = 0;

    for (let i = 0; i < specs.length; i++) {
        const spec = specs[i];
        const lId = leadId(i + 1);
        const ownerId = owners[i % owners.length];
        const baseDaysAgo = Math.floor(Math.random() * 6) + 1;
        const baseTime = daysAgo(baseDaysAgo);
        const hasPhone = spec.status !== "NEW";

        await prisma.lead.create({
            data: {
                id: lId,
                fullName: randomName(i),
                phone: hasPhone ? randomPhone() : null,
                province: PROVINCES[i % PROVINCES.length],
                licenseType: "B2",
                source: SOURCES[i % SOURCES.length],
                channel: CHANNELS[i % CHANNELS.length],
                status: spec.status,
                branchId: R.branchQ1,
                ownerId,
                lastContactAt: baseTime,
                createdAt: baseTime,
            },
        });

        for (let j = 0; j < spec.events.length; j++) {
            const eventType = spec.events[j];
            const eventTime = hoursAfter(baseTime, j * 2 + 1);
            await prisma.leadEvent.create({
                data: {
                    leadId: lId,
                    type: eventType,
                    createdById: ownerId,
                    createdAt: eventTime,
                    payload: eventType === "CALLED"
                        ? { outcome: "interested", duration: Math.floor(Math.random() * 300) + 30 }
                        : eventType === "OWNER_CHANGED"
                            ? { from: null, to: ownerId }
                            : undefined,
                },
            });
            eventCount++;
        }

        // Extra CALLED events for leads beyond NEW
        if (hasPhone) {
            const extraCalls = Math.floor(Math.random() * 3) + 1;
            for (let c = 0; c < extraCalls; c++) {
                await prisma.leadEvent.create({
                    data: {
                        leadId: lId,
                        type: "CALLED",
                        createdById: ownerId,
                        createdAt: hoursAfter(baseTime, spec.events.length * 2 + c * 3),
                        payload: {
                            outcome: ["interested", "call_back", "no_answer"][c % 3],
                            duration: Math.floor(Math.random() * 180) + 15,
                        },
                    },
                });
                eventCount++;
            }
        }
    }
    console.log(`  ✅ ${specs.length} leads, ${eventCount} events\n`);

    // ── 6. Students + Receipts ─────────────────────────────────────
    console.log("🎓 Creating students & receipts...");
    const signedLeadIndices = specs.map((s, i) => (s.status === "SIGNED" ? i : -1)).filter((i) => i >= 0);
    const arrivedLeadIndex = specs.findIndex((s) => s.status === "ARRIVED");
    const studentLeadIndices = [...signedLeadIndices, arrivedLeadIndex].filter((i) => i >= 0).slice(0, 5);

    const TUITION = 12_000_000;
    const paymentPlans: { amount: number; method: ReceiptMethod }[][] = [
        [{ amount: 6_000_000, method: "cash" }, { amount: 3_000_000, method: "bank_transfer" }],
        [{ amount: 8_000_000, method: "bank_transfer" }],
        [{ amount: 12_000_000, method: "bank_transfer" }],
        [{ amount: 3_000_000, method: "cash" }],
        [{ amount: 2_000_000, method: "cash" }, { amount: 1_000_000, method: "bank_transfer" }],
    ];

    let receiptCount = 0;
    for (let s = 0; s < studentLeadIndices.length; s++) {
        const li = studentLeadIndices[s];
        const lId = leadId(li + 1);
        const sId = studentId(s + 1);

        await prisma.student.create({
            data: {
                id: sId,
                leadId: lId,
                branchId: R.branchQ1,
                tuitionPlanId: R.planB2,
                tuitionSnapshot: TUITION,
                signedAt: daysAgo(3),
                studyStatus: "studying",
            },
        });

        const payments = paymentPlans[s] || [];
        for (let p = 0; p < payments.length; p++) {
            await prisma.receipt.create({
                data: {
                    studentId: sId,
                    branchId: R.branchQ1,
                    amount: payments[p].amount,
                    method: payments[p].method,
                    createdById: R.admin,
                    receivedAt: daysAgo(3 - p),
                    note: `Đóng tiền lần ${p + 1}`,
                },
            });
            receiptCount++;
        }
    }
    console.log(`  ✅ ${studentLeadIndices.length} students, ${receiptCount} receipts\n`);

    // ── Summary ────────────────────────────────────────────────────
    console.log("═══════════════════════════════════════");
    console.log("✅ DEMO SEED COMPLETE!");
    console.log("═══════════════════════════════════════");
    console.log("");
    console.log("Demo accounts:");
    console.log("  admin:     admin@thayduy.local     / Admin@123456  (admin)");
    console.log("  page1:     page1@thayduy.local     / Admin@123456  (direct_page)");
    console.log("  telesale1: telesale1@thayduy.local / Admin@123456  (telesales)");
    console.log("  finance1:  finance1@thayduy.local  / Admin@123456  (viewer)");
    console.log("");
}

main()
    .catch((e) => {
        console.error("❌ Seed failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
