import { spawn, spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const host = "127.0.0.1";
const port = Number(process.env.E2E_PORT || process.env.PORT || 4173);
const baseUrl = process.env.BASE_URL || `http://${host}:${port}`;
const testArgs = process.argv.slice(2);

function runSync(cmd, args, env = process.env) {
  const result = spawnSync(cmd, args, { stdio: "inherit", env });
  if (typeof result.status === "number" && result.status !== 0) process.exit(result.status);
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
}

async function waitForHealth(url, timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // ignore until timeout
    }
    await sleep(1000);
  }
  throw new Error(`Timeout chờ health endpoint: ${url}`);
}

runSync("npm", ["run", "build"]);

const server = spawn("npm", ["run", "start"], {
  stdio: "inherit",
  env: {
    ...process.env,
    HOSTNAME: host,
    PORT: String(port),
  },
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (!server.killed) server.kill(signal);
  });
}

try {
  await waitForHealth(`${baseUrl}/api/health/db`);
  const test = spawnSync("npx", ["playwright", "test", ...testArgs], {
    stdio: "inherit",
    env: {
      ...process.env,
      BASE_URL: baseUrl,
    },
  });
  if (typeof test.status === "number" && test.status !== 0) process.exit(test.status);
  if (test.error) {
    console.error(test.error);
    process.exit(1);
  }
} finally {
  if (!server.killed) server.kill("SIGTERM");
}
