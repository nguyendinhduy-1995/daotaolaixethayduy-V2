/**
 * Seed 3 default permission groups:
 *   1. Nhân viên (Staff)
 *   2. Trưởng phòng (Department Manager)
 *   3. Quản trị (Admin)
 *
 * Run: npx tsx scripts/seed-permission-groups.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

type ModuleKey = string;
type ActionKey = "VIEW" | "CREATE" | "UPDATE" | "FEEDBACK" | "EDIT" | "DELETE" | "EXPORT" | "ASSIGN" | "RUN" | "INGEST";

const ALL_ACTIONS: ActionKey[] = ["VIEW", "CREATE", "UPDATE", "FEEDBACK", "EDIT", "DELETE", "EXPORT", "ASSIGN", "RUN", "INGEST"];

// ─── Nhân viên (Staff / Telesales) ───────────────────────────
// Chỉ xem và thao tác cơ bản với lead, xem lịch, biên lai, thông báo
const STAFF_PERMISSIONS: Record<ModuleKey, ActionKey[]> = {
    overview: ["VIEW"],
    leads: ["VIEW", "CREATE", "UPDATE"],
    leads_board: ["VIEW"],
    kpi_daily: ["VIEW"],
    goals: ["VIEW"],
    schedule: ["VIEW"],
    receipts: ["VIEW", "CREATE"],
    notifications: ["VIEW", "UPDATE"],
    my_payroll: ["VIEW"],
    outbound_jobs: ["VIEW"],
    messaging: ["VIEW"],
};

// ─── Trưởng phòng (Department Manager) ───────────────────────
// Staff + quản lý lead nâng cao, học viên, khoá học, lịch học,
// biên lai, KPI, HR cơ bản, chi phí, báo cáo marketing
const MANAGER_PERMISSIONS: Record<ModuleKey, ActionKey[]> = {
    overview: ["VIEW"],
    leads: ["VIEW", "CREATE", "UPDATE", "DELETE", "EXPORT", "ASSIGN"],
    leads_board: ["VIEW"],
    students: ["VIEW", "CREATE", "UPDATE"],
    courses: ["VIEW", "CREATE", "UPDATE"],
    schedule: ["VIEW", "CREATE", "UPDATE"],
    receipts: ["VIEW", "CREATE", "UPDATE"],
    kpi_daily: ["VIEW"],
    kpi_targets: ["VIEW", "EDIT"],
    goals: ["VIEW", "EDIT"],
    ai_suggestions: ["VIEW", "CREATE", "FEEDBACK"],
    notifications: ["VIEW", "CREATE", "UPDATE"],
    outbound_jobs: ["VIEW", "CREATE"],
    messaging: ["VIEW", "CREATE"],
    my_payroll: ["VIEW"],
    hr_attendance: ["VIEW", "CREATE", "UPDATE"],
    hr_kpi: ["VIEW", "CREATE"],
    expenses: ["VIEW", "EDIT"],
    insights: ["VIEW"],
    automation_logs: ["VIEW"],
    marketing_meta_ads: ["VIEW"],
    admin_branches: ["VIEW"],
    admin_tuition: ["VIEW"],
};

// ─── Quản trị (Admin) ────────────────────────────────────────
// Full access tất cả modules
const ALL_MODULES: ModuleKey[] = [
    "overview", "leads", "leads_board", "kpi_daily", "kpi_targets", "goals",
    "ai_kpi_coach", "ai_suggestions", "students", "courses", "schedule",
    "receipts", "notifications", "outbound_jobs", "messaging", "my_payroll",
    "ops_ai_hr", "ops_n8n", "automation_logs", "automation_run",
    "marketing_meta_ads", "admin_branches", "admin_users", "admin_segments",
    "admin_tuition", "admin_notification_admin", "admin_automation_admin",
    "admin_send_progress", "admin_plans", "admin_student_content",
    "admin_instructors", "hr_kpi", "hr_payroll_profiles", "hr_attendance",
    "hr_total_payroll", "api_hub", "expenses", "salary", "insights",
    "admin_tracking",
];

const ADMIN_PERMISSIONS: Record<ModuleKey, ActionKey[]> = {};
for (const mod of ALL_MODULES) {
    ADMIN_PERMISSIONS[mod] = [...ALL_ACTIONS];
}

const GROUPS = [
    { name: "Nhân viên", description: "Quyền cơ bản cho nhân viên telesales / direct_page", permissions: STAFF_PERMISSIONS },
    { name: "Trưởng phòng", description: "Quyền quản lý: lead, học viên, khoá học, lịch, KPI, HR cơ bản, chi phí", permissions: MANAGER_PERMISSIONS },
    { name: "Trưởng phòng kiêm Telesales", description: "Quyền trưởng phòng + trực tiếp làm telesales (quản lý + bán hàng)", permissions: MANAGER_PERMISSIONS },
    { name: "Quản trị", description: "Full quyền – admin hệ thống", permissions: ADMIN_PERMISSIONS },
];

async function main() {
    for (const group of GROUPS) {
        console.log(`\n📦 Seeding group: ${group.name}`);

        const existing = await prisma.permissionGroup.findFirst({ where: { name: group.name } });
        let groupId: string;

        if (existing) {
            groupId = existing.id;
            console.log(`  ↳ Already exists (${groupId}), updating rules...`);
        } else {
            const created = await prisma.permissionGroup.create({
                data: { name: group.name, description: group.description, isSystem: true },
            });
            groupId = created.id;
            console.log(`  ↳ Created (${groupId})`);
        }

        // Delete existing rules and re-create
        await prisma.permissionRule.deleteMany({ where: { groupId } });

        const rules: Array<{ groupId: string; module: string; action: string; allowed: boolean }> = [];
        for (const [mod, actions] of Object.entries(group.permissions)) {
            for (const action of actions) {
                rules.push({ groupId, module: mod, action, allowed: true });
            }
        }

        // Batch create
        for (const rule of rules) {
            await prisma.permissionRule.create({
                data: {
                    groupId: rule.groupId,
                    module: rule.module as never,
                    action: rule.action as never,
                    allowed: rule.allowed,
                },
            });
        }

        console.log(`  ↳ ${rules.length} permission rules seeded`);
    }

    console.log("\n✅ All permission groups seeded successfully!");
}

main()
    .catch((err) => {
        console.error("❌ Error:", err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
        process.exit(0);
    });
