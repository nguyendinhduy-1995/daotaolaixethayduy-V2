import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});
const DEFAULT_BRANCH_ID = "__DEFAULT_BRANCH__";
const DEFAULT_BRANCH_CODE = "DEFAULT";

function nowIso() {
  return new Date().toISOString();
}

async function ensureDefaultBranch() {
  const existing = await prisma.branch.findFirst({ where: { code: DEFAULT_BRANCH_CODE } });
  if (existing) return existing;
  return prisma.branch.create({
    data: {
      id: DEFAULT_BRANCH_ID,
      code: DEFAULT_BRANCH_CODE,
      name: "Chi nhánh mặc định",
      isActive: true,
    },
  });
}

async function safeRows(load) {
  try {
    return await load();
  } catch {
    return [];
  }
}

async function backfillLeads(defaultBranchId, orphans) {
  const rows = await safeRows(() => prisma.lead.findMany({
    where: { branchId: null },
    select: { id: true, owner: { select: { branchId: true } } },
  }));
  for (const row of rows) {
    const branchId = row.owner?.branchId || defaultBranchId;
    if (!row.owner?.branchId) {
      orphans.push({ table: "Lead", id: row.id, reason: "Không resolve từ owner.branchId" });
    }
    await prisma.lead.update({ where: { id: row.id }, data: { branchId } });
  }
  return rows.length;
}

async function backfillStudents(defaultBranchId, orphans) {
  const rows = await safeRows(() => prisma.student.findMany({
    where: { branchId: null },
    select: {
      id: true,
      lead: { select: { branchId: true, owner: { select: { branchId: true } } } },
      course: { select: { students: { take: 1, select: { branchId: true } } } },
    },
  }));
  for (const row of rows) {
    const branchId =
      row.lead.branchId ||
      row.lead.owner?.branchId ||
      row.course?.students?.[0]?.branchId ||
      defaultBranchId;
    if (!row.lead.branchId && !row.lead.owner?.branchId && !row.course?.students?.[0]?.branchId) {
      orphans.push({ table: "Student", id: row.id, reason: "Không resolve từ lead/course" });
    }
    await prisma.student.update({ where: { id: row.id }, data: { branchId } });
  }
  return rows.length;
}

async function backfillReceipts(defaultBranchId, orphans) {
  const rows = await safeRows(() => prisma.receipt.findMany({
    where: { branchId: null },
    select: {
      id: true,
      student: { select: { branchId: true, lead: { select: { branchId: true, owner: { select: { branchId: true } } } } } },
    },
  }));
  for (const row of rows) {
    const branchId = row.student.branchId || row.student.lead.branchId || row.student.lead.owner?.branchId || defaultBranchId;
    if (!row.student.branchId && !row.student.lead.branchId && !row.student.lead.owner?.branchId) {
      orphans.push({ table: "Receipt", id: row.id, reason: "Không resolve từ student/lead" });
    }
    await prisma.receipt.update({ where: { id: row.id }, data: { branchId } });
  }
  return rows.length;
}

async function backfillSchedule(defaultBranchId, orphans) {
  const rows = await safeRows(() => prisma.courseScheduleItem.findMany({
    where: { branchId: null },
    select: { id: true, course: { select: { students: { take: 1, select: { branchId: true } } } } },
  }));
  for (const row of rows) {
    const branchId = row.course.students?.[0]?.branchId || defaultBranchId;
    if (!row.course.students?.[0]?.branchId) {
      orphans.push({ table: "CourseScheduleItem", id: row.id, reason: "Không resolve từ course.students" });
    }
    await prisma.courseScheduleItem.update({ where: { id: row.id }, data: { branchId } });
  }
  return rows.length;
}

async function backfillAutomation(defaultBranchId, orphans) {
  const rows = await safeRows(() => prisma.automationLog.findMany({
    where: { branchId: null },
    select: {
      id: true,
      lead: { select: { branchId: true, owner: { select: { branchId: true } } } },
      student: { select: { branchId: true, lead: { select: { branchId: true, owner: { select: { branchId: true } } } } } },
    },
  }));
  for (const row of rows) {
    const branchId =
      row.lead?.branchId ||
      row.student?.branchId ||
      row.student?.lead.branchId ||
      row.lead?.owner?.branchId ||
      row.student?.lead.owner?.branchId ||
      defaultBranchId;
    if (!row.lead?.branchId && !row.student?.branchId && !row.student?.lead.branchId) {
      orphans.push({ table: "AutomationLog", id: row.id, reason: "Không resolve từ lead/student" });
    }
    await prisma.automationLog.update({ where: { id: row.id }, data: { branchId } });
  }
  return rows.length;
}

async function backfillOutbound(defaultBranchId, orphans) {
  const rows = await safeRows(() => prisma.outboundMessage.findMany({
    where: { branchId: null },
    select: {
      id: true,
      lead: { select: { branchId: true, owner: { select: { branchId: true } } } },
      student: { select: { branchId: true, lead: { select: { branchId: true, owner: { select: { branchId: true } } } } } },
      notification: {
        select: {
          lead: { select: { branchId: true, owner: { select: { branchId: true } } } },
          student: { select: { branchId: true, lead: { select: { branchId: true, owner: { select: { branchId: true } } } } } },
        },
      },
    },
  }));
  for (const row of rows) {
    const branchId =
      row.lead?.branchId ||
      row.student?.branchId ||
      row.notification?.lead?.branchId ||
      row.notification?.student?.branchId ||
      row.student?.lead.branchId ||
      row.notification?.student?.lead.branchId ||
      row.lead?.owner?.branchId ||
      row.student?.lead.owner?.branchId ||
      row.notification?.lead?.owner?.branchId ||
      row.notification?.student?.lead.owner?.branchId ||
      defaultBranchId;
    if (!row.lead?.branchId && !row.student?.branchId && !row.notification?.lead?.branchId && !row.notification?.student?.branchId) {
      orphans.push({ table: "OutboundMessage", id: row.id, reason: "Không resolve từ lead/student/notification" });
    }
    await prisma.outboundMessage.update({ where: { id: row.id }, data: { branchId } });
  }
  return rows.length;
}

async function main() {
  const defaultBranch = await ensureDefaultBranch();
  const orphans = [];
  const stats = {};

  stats.leads = await backfillLeads(defaultBranch.id, orphans);
  stats.students = await backfillStudents(defaultBranch.id, orphans);
  stats.receipts = await backfillReceipts(defaultBranch.id, orphans);
  stats.schedule = await backfillSchedule(defaultBranch.id, orphans);
  stats.automation = await backfillAutomation(defaultBranch.id, orphans);
  stats.outbound = await backfillOutbound(defaultBranch.id, orphans);

  mkdirSync(join(process.cwd(), "artifacts"), { recursive: true });
  const lines = [
    "# ORPHAN_RECORDS",
    "",
    `- Generated at: ${nowIso()}`,
    `- Default branch: ${defaultBranch.id} (${defaultBranch.code || "NO_CODE"})`,
    "",
    "## Summary",
    `- Leads backfilled: ${stats.leads}`,
    `- Students backfilled: ${stats.students}`,
    `- Receipts backfilled: ${stats.receipts}`,
    `- Schedule items backfilled: ${stats.schedule}`,
    `- Automation logs backfilled: ${stats.automation}`,
    `- Outbound messages backfilled: ${stats.outbound}`,
    `- Orphans: ${orphans.length}`,
    "",
    "## Orphan details",
  ];

  if (orphans.length === 0) {
    lines.push("- Không có orphan record.");
  } else {
    for (const orphan of orphans) {
      lines.push(`- [${orphan.table}] ${orphan.id}: ${orphan.reason}`);
    }
  }

  const outPath = join(process.cwd(), "artifacts", "ORPHAN_RECORDS.md");
  writeFileSync(outPath, `${lines.join("\n")}\n`, "utf8");
  console.log("Backfill done:", stats);
  console.log("Orphan report:", outPath);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
