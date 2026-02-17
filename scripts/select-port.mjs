import net from "node:net";

function toValidPort(value) {
  const n = Number(value);
  if (!Number.isInteger(n)) return null;
  if (n < 1 || n > 65535) return null;
  return n;
}

async function isPortFree(port, host = "127.0.0.1") {
  return await new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on("error", () => resolve(false));
    server.listen({ port, host }, () => {
      server.close(() => resolve(true));
    });
  });
}

export async function selectPort(options = {}) {
  const host = options.host || "127.0.0.1";
  const fromEnv = toValidPort(process.env.PORT);
  if (fromEnv !== null) {
    for (let port = fromEnv; port <= 65535; port += 1) {
      if (await isPortFree(port, host)) return port;
    }
    throw new Error("Không tìm được cổng trống từ PORT env.");
  }

  const preferred = [3000, 3005];
  for (const port of preferred) {
    if (await isPortFree(port, host)) return port;
  }

  for (let port = 3006; port <= 65535; port += 1) {
    if (await isPortFree(port, host)) return port;
  }

  throw new Error("Không tìm được cổng trống.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = await selectPort();
  process.stdout.write(`PORT=${port}\n`);
}
