// pnpm dev
// Runs the Next.js app and the local Paystack mock together, with one
// prefixed log stream. Ports come from apps/web/.env (written by
// `pnpm setup`). If the dev Postgres from setup is stopped, it is started.
// Ctrl+C stops both.
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import pc from "picocolors";

import { parseEnv } from "./setup/env-file";
import { isPortFree, portOf } from "./setup/ports";
import { canConnect, startServer, withDatabase } from "./setup/postgres";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ENV_PATH = `${ROOT}apps/web/.env`;
const c = pc.createColors(
  Boolean(process.stdout.isTTY) && !process.env.NO_COLOR
);

function die(message: string, hint?: string): never {
  process.stderr.write(`${c.red("✗")} ${message}\n`);
  if (hint) {
    process.stderr.write(`  ${c.dim(hint)}\n`);
  }
  process.exit(1);
}

if (!existsSync(ENV_PATH)) {
  die("apps/web/.env is missing.", "Run `pnpm setup` first.");
}
const env = parseEnv(readFileSync(ENV_PATH, "utf8"));
const appPort = portOf(env.get("BETTER_AUTH_URL")) ?? 3000;
const apiUrl = env.get("PAYSTACK_API_URL");
const mockPort = /^http:\/\/(localhost|127\.0\.0\.1)/.test(apiUrl ?? "")
  ? Number(env.get("PAYSTACK_MOCK_PORT")) || portOf(apiUrl)
  : null;

const dbUrl = env.get("DATABASE_URL");
if (dbUrl && !(await canConnect(withDatabase(dbUrl, "postgres")))) {
  const url = new URL(dbUrl);
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  const managed = existsSync(`${ROOT}.pgdata`) || url.password === "postgres";
  if (!(local && managed)) {
    die(
      `Postgres at ${url.host} is not answering.`,
      "Start it, or run `pnpm setup`."
    );
  }
  process.stdout.write(`${c.dim("Starting the dev Postgres…")}\n`);
  await startServer({
    port: Number(url.port) || 5432,
    database: url.pathname.slice(1),
  });
}

for (const [name, port] of [
  ["app", appPort],
  ["mock", mockPort],
] as const) {
  if (port && !(await isPortFree(port))) {
    die(
      `Port ${port} (${name}) is already in use.`,
      "Is `pnpm dev` already running in another terminal? Otherwise stop that process or re-run `pnpm setup` on a fresh .env."
    );
  }
}

const children: ChildProcess[] = [];
let stopping = false;

function start(name: string, color: (s: string) => string, args: string[]) {
  const child = spawn("pnpm", args, {
    cwd: ROOT,
    env: { ...process.env, FORCE_COLOR: process.stdout.isTTY ? "1" : "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const prefix = color(`${name.padEnd(4)} │ `);
  for (const stream of [child.stdout, child.stderr]) {
    createInterface({ input: stream }).on("line", (line) => {
      process.stdout.write(`${prefix}${line}\n`);
    });
  }
  child.on("exit", (code) => {
    if (!stopping) {
      process.stdout.write(`${prefix}${c.red(`exited with ${code}`)}\n`);
      stop(code ?? 1);
    }
  });
  children.push(child);
}

function stop(code = 0) {
  stopping = true;
  for (const child of children) {
    child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(code), 500).unref();
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

process.stdout.write(
  `${c.bgCyan(c.black(" turbo-start "))} app ${c.cyan(`http://localhost:${appPort}`)}${
    mockPort ? ` · Paystack mock ${c.cyan(`http://localhost:${mockPort}`)}` : ""
  } ${c.dim("· Ctrl+C stops both")}\n`
);
start("app", c.green, ["--filter", "web", "dev", "--port", String(appPort)]);
if (mockPort) {
  start("mock", c.cyan, ["--filter", "@workspace/scripts", "paystack:mock"]);
}
