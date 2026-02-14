import "dotenv/config";
import bcrypt from "bcrypt";
import { prisma } from "./prisma";


async function main() {
  const email = "admin@thayduy.local";
  const password = "Admin@123456";

  const hash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: { password: hash, role: "admin", isActive: true, name: "Admin" },
    create: { email, password: hash, role: "admin", isActive: true, name: "Admin" },
  });

  try {
    await prisma.notificationRule.upsert({
      where: { name: "finance-default" },
      update: {
        scope: "FINANCE",
        isActive: true,
        config: {
          dueInDays: 0,
          highPriorityAfterDays: 7,
          mediumPriorityNoReceiptDays: 14,
          dedupeDays: 3,
        },
      },
      create: {
        name: "finance-default",
        scope: "FINANCE",
        isActive: true,
        config: {
          dueInDays: 0,
          highPriorityAfterDays: 7,
          mediumPriorityNoReceiptDays: 14,
          dedupeDays: 3,
        },
      },
    });
  } catch {
    // Notification tables may not exist yet in a fresh DB without migration.
  }

  console.log("✅ Seeded admin:", { email, password });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    // Prisma 7 + adapter vẫn disconnect ok
    await prisma.$disconnect();
  });
