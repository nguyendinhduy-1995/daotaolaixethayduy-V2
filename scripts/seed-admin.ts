import "dotenv/config";
import bcrypt from "bcrypt";
import { prisma } from "./prisma.ts";

async function main() {
  const email = "admin@thayduy.local";
  const username = "Nguyendinhduy";
  const password = "Admin@123456";

  const hash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { username },
    update: { password: hash, role: "admin", isActive: true, name: "Admin", email, username },
    create: { email, username, password: hash, role: "admin", isActive: true, name: "Admin" },
  });

  console.log("Seeded admin: admin@thayduy.local / Admin@123456");
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
