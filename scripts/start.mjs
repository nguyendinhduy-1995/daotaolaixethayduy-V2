import { spawn } from "node:child_process";

const host = process.env.HOSTNAME?.trim() || "127.0.0.1";
const parsed = Number(process.env.PORT);
const port = Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : 3000;

const env = {
  ...process.env,
  HOSTNAME: host,
  PORT: String(port),
};

process.stdout.write(`[start] HOSTNAME=${host} PORT=${port}\n`);

const child = spawn(
  process.execPath,
  ["./node_modules/next/dist/bin/next", "start", "-H", host, "-p", String(port)],
  { stdio: "inherit", env }
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
