import "dotenv/config";
import bcrypt from "bcrypt";
import {
  AutomationStatus,
  MessageDirection,
  NotificationPriority,
  NotificationScope,
  NotificationStatus,
  OutboundChannel,
  OutboundPriority,
  OutboundStatus,
  PrismaClient,
  ReceiptMethod,
  Role,
  ScheduleManualStatus,
  ScheduleSource,
  ScheduleType,
  StudyStatus,
  AttendanceStatus,
  HrAttendanceSource,
  HrAttendanceStatus,
  CommissionSourceType,
  PayrollStatus,
  EmployeeKpiRole,
  OpsPulseRole,
  LeadEventType,
  LeadStatus,
  GoalPeriodType,
  AiScoreColor,
  type Course,
  type Lead,
  type Student,
  type TuitionPlan,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

function mulberry32(seed: number) {
  return function rand() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260216);

function rInt(min: number, max: number) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function pick<T>(items: T[]): T {
  return items[rInt(0, items.length - 1)];
}

function ictDate(y: number, m: number, d: number, hh = 0, mm = 0) {
  return new Date(Date.UTC(y, m - 1, d, hh - 7, mm, 0));
}

function addDays(base: Date, days: number, hh = 8, mm = 0) {
  const utc = new Date(base.getTime());
  utc.setUTCDate(utc.getUTCDate() + days);
  return ictDate(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate(), hh, mm);
}

function viPhone(i: number) {
  return `09${String(10000000 + i).slice(0, 8)}`;
}

async function clearData() {
  const safeDelete = async (modelName: string) => {
    try {
      await (prisma as unknown as Record<string, { deleteMany: () => Promise<unknown> }>)[modelName].deleteMany();
    } catch {
      // Một số môi trường dev có thể thiếu bảng theo migration cũ.
    }
  };

  const order = [
    "expenseInsight",
    "aiSuggestionFeedback",
    "aiSuggestion",
    "goalSetting",
    "kpiTarget",
    "branchExpenseDaily",
    "branchBaseSalary",
    "expenseCategory",
    "attendanceAudit",
    "attendanceRecord",
    "attendanceSession",
    "payrollItem",
    "payrollRun",
    "commissionLedger",
    "attendance",
    "salaryProfile",
    "employeeKpiSetting",
    "opsPulse",
    "marketingReport",
    "outboundMessage",
    "notification",
    "automationLog",
    "receipt",
    "studentAccount",
    "studentContent",
    "courseScheduleItem",
    "student",
    "leadEvent",
    "leadMessage",
    "lead",
    "course",
    "tuitionPlan",
    "messageTemplate",
    "notificationRule",
    "userPermissionOverride",
    "permissionRule",
    "permissionGroup",
    "commissionScheme",
    "user",
    "branch",
    "trackingCode",
  ] as const;

  for (const modelName of order) {
    await safeDelete(modelName);
  }
}

async function main() {
  await clearData();

  const now = ictDate(2026, 2, 16, 9, 0);
  const passwordAdmin = await bcrypt.hash("Nguyendinhduy@95", 10);
  const passwordDefault = await bcrypt.hash("Admin@123456", 10);

  const branches = await prisma.$transaction([
    prisma.branch.create({ data: { name: "Chi nhánh Quận 1", code: "Q1", isActive: true, commissionPerPaid50: 350000 } }),
    prisma.branch.create({ data: { name: "Chi nhánh Bình Thạnh", code: "BT", isActive: true, commissionPerPaid50: 320000 } }),
    prisma.branch.create({ data: { name: "Chi nhánh Thủ Đức", code: "TD", isActive: true, commissionPerPaid50: 300000 } }),
  ]);

  const users = await prisma.$transaction([
    prisma.user.create({
      data: {
        username: "Nguyendinhduy",
        email: "nguyendinhduy@thayduy.local",
        name: "Nguyendinhduy",
        password: passwordAdmin,
        role: Role.admin,
        isActive: true,
        branchId: branches[0].id,
      },
    }),
    prisma.user.create({
      data: {
        username: "admin",
        email: "admin@thayduy.local",
        name: "Admin",
        password: passwordDefault,
        role: Role.admin,
        isActive: true,
        branchId: branches[0].id,
      },
    }),
    prisma.user.create({
      data: {
        username: "ops",
        email: "ops@thayduy.local",
        name: "OPS",
        password: passwordDefault,
        role: Role.manager,
        isActive: true,
        branchId: branches[0].id,
      },
    }),
    prisma.user.create({
      data: {
        username: "telesale1",
        email: "telesale1@thayduy.local",
        name: "Telesale 1",
        password: passwordDefault,
        role: Role.telesales,
        isActive: true,
        branchId: branches[0].id,
      },
    }),
    prisma.user.create({
      data: {
        username: "telesale2",
        email: "telesale2@thayduy.local",
        name: "Telesale 2",
        password: passwordDefault,
        role: Role.telesales,
        isActive: true,
        branchId: branches[1].id,
      },
    }),
    prisma.user.create({
      data: {
        username: "telesale3",
        email: "telesale3@thayduy.local",
        name: "Telesale 3",
        password: passwordDefault,
        role: Role.telesales,
        isActive: true,
        branchId: branches[2].id,
      },
    }),
    prisma.user.create({
      data: {
        username: "trucpage",
        email: "directpage@thayduy.local",
        name: "Trực Page",
        password: passwordDefault,
        role: Role.direct_page,
        isActive: true,
        branchId: branches[1].id,
      },
    }),
    prisma.user.create({
      data: {
        username: "viewer",
        email: "viewer@thayduy.local",
        name: "Viewer",
        password: passwordDefault,
        role: Role.viewer,
        isActive: true,
        branchId: branches[2].id,
      },
    }),
  ]);

  const salesUsers = users.filter((u) => u.role === Role.telesales || u.role === Role.direct_page);
  const payrollUsers = users.filter((u) => u.role !== Role.viewer);

  const schemeA = await prisma.commissionScheme.create({
    data: {
      name: "Scheme Telesales 2026",
      role: "telesales",
      isActive: true,
      rulesJson: {
        paid50: 300000,
        fullPaidBonus: 200000,
      },
    },
  });
  const schemeB = await prisma.commissionScheme.create({
    data: {
      name: "Scheme Ops 2026",
      role: "manager",
      isActive: true,
      rulesJson: {
        kpiBonus: 1500000,
      },
    },
  });

  for (const user of payrollUsers) {
    await prisma.salaryProfile.create({
      data: {
        userId: user.id,
        branchId: user.branchId ?? branches[0].id,
        roleTitle: user.role === Role.admin ? "Quản trị" : user.role === Role.manager ? "OPS" : "Telesales",
        baseSalaryVnd: user.role === Role.admin ? 22000000 : user.role === Role.manager ? 18000000 : 10000000,
        allowanceVnd: user.role === Role.manager ? 2000000 : 1200000,
        standardDays: 26,
        commissionSchemeId: user.role === Role.manager ? schemeB.id : schemeA.id,
        effectiveFrom: ictDate(2026, 1, 1, 0, 0),
      },
    });
  }

  for (const branch of branches) {
    for (const name of ["Mặt bằng", "Điện nước", "Wifi", "Chi phí khác"]) {
      await prisma.expenseCategory.create({
        data: { branchId: branch.id, name, isActive: true },
      });
    }
  }

  const planSeeds = [
    { province: "TP.HCM", licenseType: "B1", tuition: 18000000 },
    { province: "TP.HCM", licenseType: "B2", tuition: 20500000 },
    { province: "TP.HCM", licenseType: "C", tuition: 24500000 },
    { province: "Đồng Nai", licenseType: "B2", tuition: 19800000 },
    { province: "Bình Dương", licenseType: "B1", tuition: 17500000 },
  ];
  const tuitionPlans: TuitionPlan[] = [];
  for (const item of planSeeds) {
    tuitionPlans.push(
      await prisma.tuitionPlan.create({
        data: { ...item, isActive: true },
      })
    );
  }

  const courses: Course[] = [];
  for (let i = 0; i < 5; i++) {
    courses.push(
      await prisma.course.create({
        data: {
          code: `K26-${String(i + 1).padStart(2, "0")}`,
          province: pick(["TP.HCM", "Đồng Nai", "Bình Dương"]),
          licenseType: pick(["B1", "B2", "C"]),
          startDate: addDays(now, -40 + i * 5, 8, 0),
          examDate: addDays(now, 45 + i * 7, 7, 30),
          description: `Khóa học K26-${String(i + 1).padStart(2, "0")}`,
          isActive: true,
        },
      })
    );
  }

  const leadNames = [
    "Nguyễn Văn An", "Trần Thị Bích", "Lê Hoàng Long", "Phạm Gia Bảo", "Đinh Ngọc Linh", "Võ Minh Tuấn",
    "Bùi Khánh Vy", "Ngô Tuấn Kiệt", "Đoàn Thu Hà", "Huỳnh Ngọc Mai", "Phan Quang Huy", "Đặng Thanh Tâm",
    "Mai Quốc Hùng", "Lý Hoài Nam", "Nguyễn Bảo Trâm", "Tạ Ngọc Sơn", "Đỗ Quỳnh Anh", "Phùng Đức Thành",
    "Trịnh Mai Phương", "Vũ Minh Châu", "Phạm Nhật Nam", "Lâm Hương Giang", "Quách Trọng Nghĩa", "Trần Kim Ngân",
  ];

  const leads: Lead[] = [];
  const statuses: LeadStatus[] = [
    LeadStatus.NEW, LeadStatus.HAS_PHONE, LeadStatus.APPOINTED, LeadStatus.ARRIVED, LeadStatus.SIGNED, LeadStatus.STUDYING,
    LeadStatus.LOST,
  ];
  for (let i = 0; i < 24; i++) {
    const owner = salesUsers[i % salesUsers.length];
    const status = statuses[i % statuses.length];
    const lead = await prisma.lead.create({
      data: {
        fullName: leadNames[i],
        phone: viPhone(i + 1),
        province: pick(["TP.HCM", "Đồng Nai", "Bình Dương"]),
        licenseType: pick(["B1", "B2", "C"]),
        source: pick(["Meta Ads", "Tiktok", "Zalo OA", "Giới thiệu"]),
        channel: pick(["FB", "ZALO", "WEB", "HOTLINE"]),
        status,
        branchId: owner.branchId ?? branches[0].id,
        ownerId: owner.id,
        note: `Lead seed #${i + 1}`,
        tags: [pick(["nóng", "trung bình", "cần gọi lại", "ưu tiên"])],
        lastContactAt: addDays(now, -rInt(0, 12), rInt(8, 18), rInt(0, 59)),
      },
    });
    leads.push(lead);

    const eventChain: LeadEventType[] = [LeadEventType.NEW, LeadEventType.HAS_PHONE, LeadEventType.CALLED];
    if (status === LeadStatus.APPOINTED || status === LeadStatus.ARRIVED || status === LeadStatus.SIGNED || status === LeadStatus.STUDYING) {
      eventChain.push(LeadEventType.APPOINTED);
    }
    if (status === LeadStatus.ARRIVED || status === LeadStatus.SIGNED || status === LeadStatus.STUDYING) {
      eventChain.push(LeadEventType.ARRIVED);
    }
    if (status === LeadStatus.SIGNED || status === LeadStatus.STUDYING) {
      eventChain.push(LeadEventType.SIGNED);
    }
    if (status === LeadStatus.STUDYING) {
      eventChain.push(LeadEventType.STUDYING);
    }
    if (status === LeadStatus.LOST) {
      eventChain.push(LeadEventType.LOST);
    }

    for (let e = 0; e < eventChain.length; e++) {
      await prisma.leadEvent.create({
        data: {
          leadId: lead.id,
          type: eventChain[e],
          payload: { step: e + 1, fromSeed: true },
          createdById: owner.id,
          createdAt: addDays(now, -14 + i, 8 + e, 10),
        },
      });
    }

    await prisma.leadMessage.create({
      data: {
        leadId: lead.id,
        channel: pick(["zalo", "facebook", "sms"]),
        direction: MessageDirection.inbound,
        content: `Khách ${lead.fullName} quan tâm khóa ${lead.licenseType}`,
        externalMessageId: `in-${i + 1}`,
        createdAt: addDays(now, -10 + i, 9, rInt(0, 59)),
      },
    });
    await prisma.leadMessage.create({
      data: {
        leadId: lead.id,
        channel: pick(["zalo", "facebook", "sms"]),
        direction: MessageDirection.outbound,
        content: "Tư vấn lộ trình học và học phí",
        externalMessageId: `out-${i + 1}`,
        createdAt: addDays(now, -9 + i, 11, rInt(0, 59)),
      },
    });
  }

  const students: Student[] = [];
  for (let i = 0; i < 20; i++) {
    const lead = leads[i];
    const plan = tuitionPlans[i % tuitionPlans.length];
    const course = courses[i % courses.length];
    const student = await prisma.student.create({
      data: {
        leadId: lead.id,
        branchId: lead.branchId,
        courseId: course.id,
        tuitionPlanId: plan.id,
        tuitionSnapshot: plan.tuition,
        signedAt: addDays(now, -25 + i, 10, 0),
        arrivedAt: addDays(now, -23 + i, 8, 30),
        studyStatus: pick([StudyStatus.studying, StudyStatus.done, StudyStatus.paused]),
        examDate: addDays(now, 30 + i, 7, 30),
        examStatus: pick(["chuẩn bị", "đã đăng ký", "chưa đăng ký"]),
      },
    });
    students.push(student);

    await prisma.studentAccount.create({
      data: {
        phone: lead.phone ?? viPhone(100 + i),
        passwordHash: await bcrypt.hash("123456", 8),
        studentId: student.id,
      },
    });
  }

  let scheduleCount = 0;
  const scheduleItems = [];
  for (let c = 0; c < courses.length; c++) {
    for (let i = 0; i < 7; i++) {
      const startAt = addDays(now, -12 + c * 2 + i * 2, 7 + (i % 3) * 4, 0);
      const endAt = new Date(startAt.getTime() + 2 * 60 * 60 * 1000);
      const status = pick([ScheduleManualStatus.PLANNED, ScheduleManualStatus.DONE, ScheduleManualStatus.CANCELLED]);
      const item = await prisma.courseScheduleItem.create({
        data: {
          courseId: courses[c].id,
          branchId: students.find((s) => s.courseId === courses[c].id)?.branchId ?? branches[0].id,
          type: pick([ScheduleType.study, ScheduleType.reminder, ScheduleType.exam]),
          title: `Buổi học #${i + 1} - ${courses[c].code}`,
          startAt,
          endAt,
          source: pick([ScheduleSource.MANUAL, ScheduleSource.AUTO]),
          status,
          location: pick(["Sân tập Q1", "Sân tập Bình Thạnh", "Sân tập Thủ Đức"]),
          note: status === ScheduleManualStatus.CANCELLED ? "Mưa lớn, dời lịch" : "Lịch học định kỳ",
        },
      });
      scheduleItems.push(item);
      scheduleCount += 1;

      if (status === ScheduleManualStatus.DONE) {
        const session = await prisma.attendanceSession.create({
          data: {
            scheduleItemId: item.id,
            note: "Điểm danh buổi học",
            createdById: users[0].id,
          },
        });
        const courseStudents = students.filter((s) => s.courseId === courses[c].id).slice(0, 4);
        for (const student of courseStudents) {
          await prisma.attendanceRecord.create({
            data: {
              sessionId: session.id,
              scheduleItemId: item.id,
              studentId: student.id,
              status: pick([AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.ABSENT]),
              note: "Seed attendance",
              updatedById: users[0].id,
            },
          });
        }
        await prisma.attendanceAudit.create({
          data: {
            scheduleItemId: item.id,
            actorId: users[0].id,
            action: "SEED_ATTENDANCE",
            diff: { source: "seed.ts" },
          },
        });
      }
    }
  }

  let receiptCount = 0;
  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    const lead = leads.find((l) => l.id === student.leadId);
    const baseTuition = student.tuitionSnapshot ?? 18000000;
    const first = Math.floor(baseTuition * 0.5);
    const second = Math.floor(baseTuition * 0.3);
    const remain = baseTuition - first - second;
    const creator = salesUsers[i % salesUsers.length];
    const payments = [first, second, remain].filter((_, idx) => idx < (i % 3 === 0 ? 2 : 3));
    for (let p = 0; p < payments.length; p++) {
      await prisma.receipt.create({
        data: {
          studentId: student.id,
          branchId: student.branchId ?? branches[0].id,
          amount: payments[p],
          method: pick([ReceiptMethod.cash, ReceiptMethod.bank_transfer, ReceiptMethod.card, ReceiptMethod.other]),
          note: `Thu học phí đợt ${p + 1}`,
          receivedAt: addDays(now, -20 + i + p * 4, 9 + p, 15),
          createdById: creator.id,
        },
      });
      receiptCount += 1;
      if (p === 0 && lead) {
        await prisma.leadEvent.create({
          data: {
            leadId: lead.id,
            type: LeadEventType.SIGNED,
            payload: { amount: payments[p], fromReceipt: true },
            createdById: creator.id,
            createdAt: addDays(now, -18 + i, 10, 10),
          },
        });
      }
    }
  }

  for (let i = 0; i < 30; i++) {
    const user = payrollUsers[i % payrollUsers.length];
    await prisma.attendance.create({
      data: {
        userId: user.id,
        branchId: user.branchId ?? branches[0].id,
        date: addDays(now, -i, 0, 0),
        status: pick([
          HrAttendanceStatus.PRESENT,
          HrAttendanceStatus.HALF,
          HrAttendanceStatus.LATE,
          HrAttendanceStatus.LEAVE_PAID,
        ]),
        minutesLate: pick([0, 5, 10, 15, 30]),
        note: "Chấm công seed",
        source: HrAttendanceSource.MANUAL,
      },
    });
  }

  const monthKey = "2026-02";
  for (const user of payrollUsers) {
    if (!user.branchId) continue;
    await prisma.branchBaseSalary.upsert({
      where: {
        userId_monthKey_branchId: {
          userId: user.id,
          monthKey,
          branchId: user.branchId,
        },
      },
      create: {
        userId: user.id,
        monthKey,
        branchId: user.branchId,
        baseSalaryVnd: user.role === Role.admin ? 22000000 : user.role === Role.manager ? 18000000 : 10000000,
        note: "Seed lương cơ bản",
      },
      update: {
        baseSalaryVnd: user.role === Role.admin ? 22000000 : user.role === Role.manager ? 18000000 : 10000000,
        note: "Seed lương cơ bản",
      },
    });
  }

  for (const branch of branches) {
    const categories = await prisma.expenseCategory.findMany({
      where: { branchId: branch.id, isActive: true },
      orderBy: { name: "asc" },
    });
    for (let day = 0; day < 18; day++) {
      const date = addDays(now, -day, 0, 0);
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, "0");
      const d = String(date.getUTCDate()).padStart(2, "0");
      const dateKey = `${y}-${m}-${d}`;
      for (const category of categories) {
        const amountVnd =
          category.name === "Mặt bằng"
            ? rInt(1200000, 1800000)
            : category.name === "Điện nước"
              ? rInt(350000, 900000)
              : category.name === "Wifi"
                ? rInt(100000, 300000)
                : rInt(200000, 700000);
        await prisma.branchExpenseDaily.upsert({
          where: {
            branchId_dateKey_categoryId: {
              branchId: branch.id,
              dateKey,
              categoryId: category.id,
            },
          },
          create: {
            branchId: branch.id,
            date,
            dateKey,
            categoryId: category.id,
            amountVnd,
            note: `Seed ${category.name}`,
            createdById: users[0].id,
          },
          update: {
            amountVnd,
            note: `Seed ${category.name}`,
          },
        });
      }
    }
  }

  for (const branch of branches) {
    for (let i = 0; i < 6; i++) {
      const day = String(16 - i).padStart(2, "0");
      await prisma.expenseInsight.create({
        data: {
          branchId: branch.id,
          dateKey: `2026-02-${day}`,
          monthKey: "2026-02",
          summary: `Chi phí ${branch.name} ngày ${day}/02 tăng ${rInt(3, 12)}% do điện nước và mặt bằng.`,
          payloadJson: { trend: "up", deltaPct: rInt(3, 12), fromSeed: true },
          source: "seed",
          runId: `seed-20260216-${branch.code ?? "branch"}-${i + 1}`,
          payloadHash: `seed-${branch.id}-${i + 1}`,
        },
      });
    }
  }

  const months = ["2025-11", "2025-12", "2026-01", "2026-02"];
  for (const month of months) {
    const run = await prisma.payrollRun.create({
      data: {
        month,
        branchId: branches[0].id,
        status: pick([PayrollStatus.DRAFT, PayrollStatus.FINAL, PayrollStatus.PAID]),
        generatedAt: addDays(now, -rInt(1, 20), 8, 0),
        generatedById: users[0].id,
      },
    });
    for (const user of payrollUsers) {
      const base = user.role === Role.admin ? 22000000 : user.role === Role.manager ? 18000000 : 10000000;
      const allowance = user.role === Role.manager ? 2000000 : 1200000;
      const commission = rInt(500000, 3500000);
      const bonus = rInt(0, 1200000);
      const penalty = rInt(0, 300000);
      const total = base + allowance + commission + bonus - penalty;
      await prisma.payrollItem.create({
        data: {
          payrollRunId: run.id,
          userId: user.id,
          baseSalaryVnd: base,
          allowanceVnd: allowance,
          daysWorked: rInt(21, 26),
          standardDays: 26,
          baseProratedVnd: Math.floor((base / 26) * rInt(21, 26)),
          commissionVnd: commission,
          penaltyVnd: penalty,
          bonusVnd: bonus,
          totalVnd: total,
          breakdownJson: { month, source: "seed.ts" },
        },
      });
    }
  }

  for (let i = 0; i < 20; i++) {
    const student = students[i];
    const owner = salesUsers[i % salesUsers.length];
    await prisma.commissionLedger.create({
      data: {
        userId: owner.id,
        branchId: owner.branchId ?? branches[0].id,
        periodMonth: "2026-02",
        sourceType: CommissionSourceType.RECEIPT,
        sourceId: `receipt-seed-${i + 1}`,
        studentId: student.id,
        amountBaseVnd: student.tuitionSnapshot ?? 18000000,
        commissionVnd: rInt(200000, 800000),
        note: "Hoa hồng từ phiếu thu seed",
        metaJson: { fromSeed: true },
      },
    });
  }

  for (let i = 0; i < 20; i++) {
    const lead = leads[i];
    const student = students[i % students.length];
    await prisma.automationLog.create({
      data: {
        branchId: lead.branchId ?? student.branchId ?? branches[0].id,
        leadId: lead.id,
        studentId: i % 2 === 0 ? student.id : null,
        channel: pick(["zalo", "sms", "facebook"]),
        templateKey: pick(["remind_paid50", "remind_remaining", "remind_schedule"]),
        milestone: pick(["paid50", "remaining", "schedule"]),
        status: pick([AutomationStatus.sent, AutomationStatus.failed, AutomationStatus.skipped]),
        sentAt: addDays(now, -rInt(0, 20), rInt(7, 21), rInt(0, 59)),
        payload: { idx: i + 1, fromSeed: true },
      },
    });
  }

  for (let i = 0; i < 20; i++) {
    const lead = leads[i];
    const student = students[i % students.length];
    const notification = await prisma.notification.create({
      data: {
        scope: pick([NotificationScope.FINANCE, NotificationScope.FOLLOWUP, NotificationScope.SCHEDULE, NotificationScope.SYSTEM]),
        status: pick([NotificationStatus.NEW, NotificationStatus.DOING, NotificationStatus.DONE, NotificationStatus.SKIPPED]),
        priority: pick([NotificationPriority.HIGH, NotificationPriority.MEDIUM, NotificationPriority.LOW]),
        title: `Thông báo seed #${i + 1}`,
        message: `Nội dung thông báo cho ${lead.fullName}`,
        payload: { idx: i + 1 },
        leadId: lead.id,
        studentId: i % 2 === 0 ? student.id : null,
        courseId: student.courseId,
        ownerId: lead.ownerId,
        dueAt: addDays(now, rInt(-2, 5), rInt(8, 20), 0),
      },
    });

    await prisma.outboundMessage.create({
      data: {
        channel: pick([OutboundChannel.ZALO, OutboundChannel.FB, OutboundChannel.SMS, OutboundChannel.CALL_NOTE]),
        to: lead.phone,
        templateKey: pick(["remind_paid50", "remind_remaining", "remind_schedule"]),
        renderedText: `Tin nhắn mẫu #${i + 1}`,
        status: pick([OutboundStatus.QUEUED, OutboundStatus.SENT, OutboundStatus.FAILED, OutboundStatus.SKIPPED]),
        priority: pick([OutboundPriority.HIGH, OutboundPriority.MEDIUM, OutboundPriority.LOW]),
        error: i % 6 === 0 ? "Provider timeout" : null,
        branchId: lead.branchId ?? student.branchId ?? branches[0].id,
        leadId: lead.id,
        studentId: i % 2 === 0 ? student.id : null,
        notificationId: notification.id,
        retryCount: i % 4,
        nextAttemptAt: i % 4 === 0 ? addDays(now, 1, 9, 0) : null,
        providerMessageId: `seed-provider-${i + 1}`,
        dispatchedAt: addDays(now, -rInt(0, 8), rInt(8, 20), rInt(0, 59)),
        sentAt: addDays(now, -rInt(0, 8), rInt(8, 20), rInt(0, 59)),
      },
    });
  }

  await prisma.$transaction([
    prisma.messageTemplate.create({
      data: {
        key: "remind_paid50",
        title: "Nhắc đóng 50% học phí",
        channel: OutboundChannel.SMS,
        body: "Chào {{name}}, bạn vui lòng hoàn tất 50% học phí.",
        isActive: true,
      },
    }),
    prisma.messageTemplate.create({
      data: {
        key: "remind_remaining",
        title: "Nhắc học phí còn lại",
        channel: OutboundChannel.ZALO,
        body: "Học phí còn lại của bạn là {{remaining}}.",
        isActive: true,
      },
    }),
    prisma.messageTemplate.create({
      data: {
        key: "remind_schedule",
        title: "Nhắc lịch học",
        channel: OutboundChannel.FB,
        body: "Bạn có lịch học vào {{scheduleAt}}.",
        isActive: true,
      },
    }),
    prisma.notificationRule.create({
      data: {
        scope: NotificationScope.FINANCE,
        name: "finance-default",
        isActive: true,
        config: { thresholdDays: 2, autoGenerate: true },
      },
    }),
  ]);

  for (let i = 0; i < 10; i++) {
    await prisma.marketingReport.create({
      data: {
        date: addDays(now, -i, 0, 0),
        dateKey: `2026-02-${String(16 - i).padStart(2, "0")}`,
        branchId: branches[i % branches.length].id,
        source: "meta",
        spendVnd: rInt(1500000, 5000000),
        messages: rInt(20, 80),
        cplVnd: rInt(50000, 180000),
        metaJson: { campaign: `META-${i + 1}` },
      },
    });
  }

  for (let i = 0; i < 12; i++) {
    const owner = salesUsers[i % salesUsers.length];
    await prisma.opsPulse.create({
      data: {
        role: i % 2 === 0 ? OpsPulseRole.PAGE : OpsPulseRole.TELESALES,
        ownerId: owner.id,
        ownerScopeKey: owner.id,
        branchId: owner.branchId,
        branchScopeKey: owner.branchId ?? "",
        dateKey: "2026-02-16",
        windowMinutes: 10,
        bucketStart: addDays(now, 0, 8, i * 5),
        payloadJson: { messagesToday: rInt(20, 120), dataToday: rInt(5, 40) },
        computedJson: { ratio: Number((rand() * 2).toFixed(2)) },
      },
    });
  }

  for (const user of salesUsers) {
    await prisma.employeeKpiSetting.create({
      data: {
        userId: user.id,
        role: user.role === Role.direct_page ? EmployeeKpiRole.PAGE : EmployeeKpiRole.TELESALES,
        effectiveFrom: ictDate(2026, 1, 1, 0, 0),
        targetsJson: {
          leadsPerDay: user.role === Role.direct_page ? 30 : 20,
          calledPerDay: 35,
          appointedPerDay: 6,
        },
        isActive: true,
      },
    });
  }

  const kpiTargetDefaults: Array<{ role: Role; metricKey: string; targetValue: number; dayOfWeek: number }> = [
    { role: Role.direct_page, metricKey: "has_phone_rate_pct", targetValue: 30, dayOfWeek: -1 },
    { role: Role.telesales, metricKey: "appointed_rate_pct", targetValue: 35, dayOfWeek: -1 },
    { role: Role.telesales, metricKey: "arrived_rate_pct", targetValue: 50, dayOfWeek: -1 },
    { role: Role.telesales, metricKey: "signed_rate_pct", targetValue: 45, dayOfWeek: -1 },
  ];

  for (const branch of branches) {
    for (const target of kpiTargetDefaults) {
      const existing = await prisma.kpiTarget.findFirst({
        where: {
          branchId: branch.id,
          role: target.role,
          metricKey: target.metricKey,
          dayOfWeek: target.dayOfWeek,
          ownerId: null,
        },
        select: { id: true },
      });
      if (existing) {
        await prisma.kpiTarget.update({
          where: { id: existing.id },
          data: { targetValue: target.targetValue, isActive: true },
        });
      } else {
        await prisma.kpiTarget.create({
          data: {
            branchId: branch.id,
            role: target.role,
            ownerId: null,
            metricKey: target.metricKey,
            targetValue: target.targetValue,
            dayOfWeek: target.dayOfWeek,
            isActive: true,
          },
        });
      }
    }
  }

  const directPageUser = users.find((u) => u.role === Role.direct_page);
  const telesalesUser = users.find((u) => u.role === Role.telesales);
  if (directPageUser?.branchId) {
    const existing = await prisma.kpiTarget.findFirst({
      where: {
        branchId: directPageUser.branchId,
        role: Role.direct_page,
        ownerId: directPageUser.id,
        metricKey: "has_phone_rate_pct",
        dayOfWeek: -1,
      },
      select: { id: true },
    });
    if (existing) {
      await prisma.kpiTarget.update({
        where: { id: existing.id },
        data: { targetValue: 38, isActive: true },
      });
    } else {
      await prisma.kpiTarget.create({
        data: {
          branchId: directPageUser.branchId,
          role: Role.direct_page,
          ownerId: directPageUser.id,
          metricKey: "has_phone_rate_pct",
          targetValue: 38,
          dayOfWeek: -1,
          isActive: true,
        },
      });
    }
  }
  if (telesalesUser?.branchId) {
    const existing = await prisma.kpiTarget.findFirst({
      where: {
        branchId: telesalesUser.branchId,
        role: Role.telesales,
        ownerId: telesalesUser.id,
        metricKey: "appointed_rate_pct",
        dayOfWeek: -1,
      },
      select: { id: true },
    });
    if (existing) {
      await prisma.kpiTarget.update({
        where: { id: existing.id },
        data: { targetValue: 42, isActive: true },
      });
    } else {
      await prisma.kpiTarget.create({
        data: {
          branchId: telesalesUser.branchId,
          role: Role.telesales,
          ownerId: telesalesUser.id,
          metricKey: "appointed_rate_pct",
          targetValue: 42,
          dayOfWeek: -1,
          isActive: true,
        },
      });
    }
  }

  for (const branch of branches) {
    await prisma.goalSetting.upsert({
      where: {
        branchScopeKey_periodType_dateKey_monthKey: {
          branchScopeKey: branch.id,
          periodType: GoalPeriodType.DAILY,
          dateKey: "2026-02-16",
          monthKey: "",
        },
      },
      create: {
        branchId: branch.id,
        branchScopeKey: branch.id,
        periodType: GoalPeriodType.DAILY,
        dateKey: "2026-02-16",
        monthKey: "",
        revenueTarget: 50000000,
        dossierTarget: 16,
        costTarget: 12000000,
        note: "Mục tiêu ngày seed",
        createdById: users[0].id,
      },
      update: {
        revenueTarget: 50000000,
        dossierTarget: 16,
        costTarget: 12000000,
        note: "Mục tiêu ngày seed",
        createdById: users[0].id,
      },
    });

    await prisma.goalSetting.upsert({
      where: {
        branchScopeKey_periodType_dateKey_monthKey: {
          branchScopeKey: branch.id,
          periodType: GoalPeriodType.MONTHLY,
          dateKey: "",
          monthKey: "2026-02",
        },
      },
      create: {
        branchId: branch.id,
        branchScopeKey: branch.id,
        periodType: GoalPeriodType.MONTHLY,
        dateKey: "",
        monthKey: "2026-02",
        revenueTarget: 1200000000,
        dossierTarget: 380,
        costTarget: 280000000,
        note: "Mục tiêu tháng seed",
        createdById: users[0].id,
      },
      update: {
        revenueTarget: 1200000000,
        dossierTarget: 380,
        costTarget: 280000000,
        note: "Mục tiêu tháng seed",
        createdById: users[0].id,
      },
    });
  }

  const aiSuggestions: Array<{ ownerId: string; role: Role; scoreColor: AiScoreColor; title: string; content: string }> = [
    {
      ownerId: salesUsers[0].id,
      role: Role.telesales,
      scoreColor: AiScoreColor.RED,
      title: "Tỷ lệ gọi đang thấp hơn mục tiêu",
      content: "- Ưu tiên gọi nhóm HAS_PHONE trong 60 phút đầu ca\\n- Tạo 10 cuộc gọi lại cho lead hẹn hôm qua",
    },
    {
      ownerId: salesUsers[1].id,
      role: Role.telesales,
      scoreColor: AiScoreColor.YELLOW,
      title: "Hồ sơ hẹn còn thiếu xác nhận",
      content: "- Gửi nhắc hẹn cho nhóm APPOINTED\\n- Chuyển 5 khách tiềm năng sang lịch gọi chiều",
    },
    {
      ownerId: users[2].id,
      role: Role.manager,
      scoreColor: AiScoreColor.GREEN,
      title: "Đội nhóm đang ổn định",
      content: "- Duy trì chất lượng data đầu vào\\n- Theo dõi tồn đọng thông báo tài chính",
    },
  ];

  for (let i = 0; i < aiSuggestions.length; i++) {
    const source = aiSuggestions[i];
    const owner = users.find((u) => u.id === source.ownerId) || users[0];
    const suggestion = await prisma.aiSuggestion.create({
      data: {
        dateKey: "2026-02-16",
        role: source.role,
        branchId: owner.branchId ?? null,
        ownerId: source.ownerId,
        status: "ACTIVE",
        title: source.title,
        content: source.content,
        scoreColor: source.scoreColor,
        actionsJson: [
          {
            type: "outbound_call",
            label: "Tạo outbound gọi nhắc",
            channel: "CALL_NOTE",
            templateKey: "remind_schedule",
            leadId: leads[i]?.id ?? null,
          },
        ],
        metricsJson: {
          gap: rInt(1, 20),
          funnel: { hasPhone: rInt(20, 50), called: rInt(10, 45), appointed: rInt(2, 12) },
        },
        source: "seed",
        runId: `seed-ai-kpi-${i + 1}`,
        payloadHash: `seed-ai-${i + 1}`,
      },
    });

    await prisma.aiSuggestionFeedback.create({
      data: {
        suggestionId: suggestion.id,
        userId: owner.id,
        rating: pick([3, 4, 5]),
        applied: pick([true, false]),
        note: "Phản hồi seed",
      },
    });
  }

  // ── TRACKING CODES (disabled templates) ──
  await prisma.trackingCode.createMany({
    data: [
      {
        site: "GLOBAL",
        key: "google_tag",
        name: "Google Tag / GA4",
        placement: "HEAD" as const,
        code: `<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>\n<script>\n  window.dataLayer = window.dataLayer || [];\n  function gtag(){dataLayer.push(arguments);}\n  gtag('js', new Date());\n  gtag('config', 'G-XXXXXXXXXX');\n</script>`,
        isEnabled: false,
      },
      {
        site: "GLOBAL",
        key: "meta_pixel",
        name: "Meta Pixel",
        placement: "HEAD" as const,
        code: `<!-- Meta Pixel Code -->\n<script>\n!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');\nfbq('init','YOUR_PIXEL_ID');\nfbq('track','PageView');\n</script>\n<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=YOUR_PIXEL_ID&ev=PageView&noscript=1"/></noscript>`,
        isEnabled: false,
      },
      {
        site: "GLOBAL",
        key: "tiktok_pixel",
        name: "TikTok Pixel",
        placement: "HEAD" as const,
        code: `<!-- TikTok Pixel Code -->\n<script>\n!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('YOUR_PIXEL_ID');ttq.page();}(window,document,'ttq');\n</script>`,
        isEnabled: false,
      },
      // Per-site disabled example
      { site: "LANDING", key: "custom_1", name: "Custom Landing Script", placement: "BODY_BOTTOM" as const, code: "<!-- Custom Landing tracking -->", isEnabled: false },
      { site: "CRM", key: "custom_1", name: "Custom CRM Script", placement: "BODY_BOTTOM" as const, code: "<!-- Custom CRM tracking -->", isEnabled: false },
      { site: "STUDENT", key: "custom_1", name: "Custom Student Script", placement: "BODY_BOTTOM" as const, code: "<!-- Custom Student tracking -->", isEnabled: false },
      { site: "TAPLAI", key: "custom_1", name: "Custom Taplai Script", placement: "BODY_BOTTOM" as const, code: "<!-- Custom Taplai tracking -->", isEnabled: false },
    ],
  });

  const summary = {
    users: await prisma.user.count(),
    leads: await prisma.lead.count(),
    leadEvents: await prisma.leadEvent.count(),
    leadMessages: await prisma.leadMessage.count(),
    students: await prisma.student.count(),
    courses: await prisma.course.count(),
    scheduleItems: await prisma.courseScheduleItem.count(),
    receipts: await prisma.receipt.count(),
    payrollItems: await prisma.payrollItem.count(),
    commissionLedgers: await prisma.commissionLedger.count(),
    automationLogs: await prisma.automationLog.count(),
    outboundMessages: await prisma.outboundMessage.count(),
    expenseCategories: await prisma.expenseCategory.count(),
    branchExpenseDaily: await prisma.branchExpenseDaily.count(),
    branchBaseSalary: await prisma.branchBaseSalary.count(),
    expenseInsights: await prisma.expenseInsight.count(),
    kpiTargets: await prisma.kpiTarget.count(),
    goals: await prisma.goalSetting.count(),
    aiSuggestions: await prisma.aiSuggestion.count(),
    aiSuggestionFeedbacks: await prisma.aiSuggestionFeedback.count(),
    trackingCodes: await prisma.trackingCode.count(),
  };

  console.log("Seed completed (deterministic).");
  console.log("Admin login: Nguyendinhduy / Nguyendinhduy@95");
  console.log("Admin email fallback: admin@thayduy.local / Admin@123456");
  console.log("Summary:", summary);
  console.log("Meta:", { receiptCount, scheduleCount, timezone: "Asia/Ho_Chi_Minh", seed: 20260216 });
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
