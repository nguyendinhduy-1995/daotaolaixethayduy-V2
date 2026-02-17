import { spawnSync } from "node:child_process";

function run(cmd, args, env = process.env) {
  const result = spawnSync(cmd, args, { stdio: "inherit", env });
  if (typeof result.status === "number" && result.status !== 0) process.exit(result.status);
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
}

run("npm", ["run", "lint"]);
run("npm", ["run", "build"]);
run("npm", ["run", "audit:permissions"]);
run("npm", ["run", "check:schema"]);

if (process.env.BASE_URL) {
  run("npx", ["playwright", "test", "tests/rbac-permissions.spec.ts"]);
}

console.log("verify PASS");
