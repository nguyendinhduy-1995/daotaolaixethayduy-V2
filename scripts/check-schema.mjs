import { spawnSync } from "node:child_process";

function run(cmd, args, env = process.env) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    env,
  });
  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
}

function runBestEffort(cmd, args, env = process.env) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    env,
  });
  if (result.error) {
    console.warn(`[check:schema] Bỏ qua bước best-effort: ${cmd} ${args.join(" ")}`);
  }
}

if (process.env.CHECK_SCHEMA_DOCKER !== "0") {
  runBestEffort("docker", ["compose", "up", "-d", "postgres"]);
}

// 1) Apply migrations first
run("npx", ["prisma", "migrate", "deploy"]);

// 2) Drift gate: DB schema must match prisma/schema.prisma
const diff = spawnSync(
  "npx",
  [
    "prisma",
    "migrate",
    "diff",
    "--from-config-datasource",
    "--to-schema",
    "prisma/schema.prisma",
    "--exit-code",
  ],
  { stdio: "inherit", env: process.env }
);

if (diff.error) {
  console.error(diff.error);
  process.exit(1);
}

// Prisma migrate diff returns:
// 0 = no diff, 2 = has diff, 1 = error
if (diff.status === 2) {
  console.error("Schema gate thất bại: DB schema đang lệch so với prisma/schema.prisma.");
  process.exit(2);
}

if ((diff.status ?? 1) !== 0) {
  process.exit(diff.status ?? 1);
}

console.log("Schema gate PASS: DB schema khớp prisma/schema.prisma.");
