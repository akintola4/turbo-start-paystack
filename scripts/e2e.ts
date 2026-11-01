// pnpm e2e [playwright args]     e.g. pnpm e2e e2e/settings.spec.ts --workers=1
// pnpm e2e --serve                set up and start the stack, then wait: run
//                                 `pnpm --filter web test:e2e` against it
// Runs the Playwright suite (apps/web/e2e) against a stack it starts from
// scratch, so every run sees the same state:
//
//   1. drops and recreates the e2e database (its name must end in `_e2e`),
//      migrates it and seeds the demo organization (plus a viewer);
//   2. starts the local Paystack mock with its own state file and creates
//      the plans on it;
//   3. starts `next dev` against the mock, waits for it, runs Playwright,
//      then stops the app and the mock.
//
// The Playwright setup project (e2e/setup.setup.ts) then signs each demo user
// in once and puts the org on a paid Pro plan through the mock checkout and
// the Simulate billing panel, the way a person would.
//
// Paystack always points at the mock (no request reaches api.paystack.co)
// and emails are only logged, whatever apps/web/.env says.
//
// E2E_DATABASE_URL  database to (re)create. Default: DATABASE_URL from
//                   apps/web/.env with `_e2e` added to its name.
// E2E_PORT          app port (default 3200, Playwright's default baseURL).
// E2E_MOCK_PORT     Paystack mock port (default 4210).
import { type ChildProcess, execFile, spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { createPaystackClient, syncPlans } from "@workspace/billing";
import { createDb } from "@workspace/db";

import { generateSecrets, parseEnv } from "./setup/env-file";
import { isPortFree } from "./setup/ports";
import {
  databaseOf,
  dropDatabase,
  ensureDatabase,
  withDatabase,
} from "./setup/postgres";
import { DEMO_USERS, seedDemo } from "./setup/seed";

const execFileAsync = promisify(execFile);
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCRIPTS = fileURLToPath(new URL(".", import.meta.url));
const WEB = `${ROOT}apps/web/`;
const ENV_PATH = `${WEB}.env`;
const MOCK_STATE = `${SCRIPTS}.paystack-mock.e2e.json`;
const MOCK_KEY = "sk_test_local_mock";

/** The role-change toast test changes her role and puts it back. */
const E2E_EXTRA_USERS = [
  {
    name: "Wanjiru Kamau",
    email: "wanjiru@kolalogistics.test",
    role: "viewer",
  },
] as const;

function die(message: string): never {
  process.stderr.write(`e2e: ${message}\n`);
  process.exit(1);
}

const log = (message: string) => process.stdout.write(`e2e: ${message}\n`);

const fileEnv = existsSync(ENV_PATH)
  ? Object.fromEntries(parseEnv(readFileSync(ENV_PATH, "utf8")))
  : {};
const base: Record<string, string | undefined> = { ...fileEnv, ...process.env };

const appPort = Number(process.env.E2E_PORT ?? 3200);
const mockPort = Number(process.env.E2E_MOCK_PORT ?? 4210);
const appUrl = `http://localhost:${appPort}`;
const mockUrl = `http://localhost:${mockPort}`;

const sourceDb = process.env.E2E_DATABASE_URL ?? base.DATABASE_URL;
if (!sourceDb) {
  die("set E2E_DATABASE_URL (or DATABASE_URL in apps/web/.env).");
}
const dbUrl = process.env.E2E_DATABASE_URL
  ? sourceDb
  : withDatabase(sourceDb, `${databaseOf(sourceDb)}_e2e`);
if (!databaseOf(dbUrl).endsWith("_e2e")) {
  die(
    `refusing to reset "${databaseOf(dbUrl)}": the e2e database's name must end in _e2e.`
  );
}
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(dbUrl).hostname)) {
  die(
    `refusing to reset a database on ${new URL(dbUrl).hostname}: pnpm e2e only resets a local Postgres.`
  );
}

// Secrets the app needs but no .env provided (CI): throwaway ones.
const secrets = Object.fromEntries(
  Object.entries(generateSecrets()).filter(([key]) => !base[key])
);

/** Everything the app and the mock run with. Empty strings count as unset
 *  in the env schema, and win over apps/web/.env in `next dev`. */
const env: Record<string, string> = {
  ...(Object.fromEntries(
    Object.entries(base).filter(([, v]) => v !== undefined)
  ) as Record<string, string>),
  ...secrets,
  NODE_ENV: "development",
  DATABASE_URL: dbUrl,
  BETTER_AUTH_URL: appUrl,
  NEXT_PUBLIC_APP_URL: appUrl,
  PAYSTACK_SECRET_KEY: MOCK_KEY,
  PAYSTACK_API_URL: mockUrl,
  PAYSTACK_MOCK_PORT: String(mockPort),
  PAYSTACK_MOCK_WEBHOOK_URL: `${appUrl}/api/webhooks/paystack`,
  PAYSTACK_MOCK_STATE: MOCK_STATE,
  PAYSTACK_WEBHOOK_IP_ALLOWLIST: "false",
  // No inline popup: it would load Paystack's script and talk to Paystack.
  NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY: "",
  // Emails go to the dev outbox and the log, never to Resend.
  RESEND_API_KEY: "",
  EMAIL_TRANSPORT: "",
  // The tests read naira amounts.
  BILLING_CURRENCY: "NGN",
  BILLING_TRIAL_MODE: "card",
  // The suite signs in more than five times a minute. The app honours this
  // only outside production and against the local mock.
  E2E_AUTH_RATE_LIMIT_SCALE: "20",
  E2E_BASE_URL: appUrl,
};

const children: ChildProcess[] = [];

function start(name: string, cmd: string, args: string[], cwd: string) {
  // Own process group, so stopping it also stops what it spawned.
  const child = spawn(cmd, args, {
    cwd,
    env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const lines: string[] = [];
  for (const stream of [child.stdout, child.stderr]) {
    stream?.on("data", (chunk: Buffer) => {
      lines.push(...chunk.toString().split("\n"));
      lines.splice(0, Math.max(0, lines.length - 40));
      if (process.env.E2E_VERBOSE) {
        process.stdout.write(`${name} │ ${chunk}`);
      }
    });
  }
  child.on("exit", (code) => {
    if (!stopping) {
      process.stderr.write(
        `e2e: ${name} exited with ${code}. Last output:\n${lines.join("\n")}\n`
      );
      stop(1);
    }
  });
  children.push(child);
  return child;
}

let stopping = false;
function stop(code: number): never {
  stopping = true;
  for (const child of children) {
    if (child.pid && child.exitCode === null) {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        // Already gone.
      }
    }
  }
  process.exit(code);
}
process.on("SIGINT", () => stop(130));
process.on("SIGTERM", () => stop(143));

async function waitFor(url: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (res.ok) {
        return;
      }
    } catch {
      // Not up yet.
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  die(`${url} did not answer within ${timeoutMs / 1000}s.`);
}

for (const [name, port] of [
  ["app", appPort],
  ["mock", mockPort],
] as const) {
  if (!(await isPortFree(port))) {
    die(
      `port ${port} (${name}) is in use. Stop that process, or set E2E_PORT / E2E_MOCK_PORT.`
    );
  }
}

log(`resetting ${databaseOf(dbUrl)}`);
await dropDatabase(dbUrl);
await ensureDatabase(dbUrl);
await execFileAsync("pnpm", ["--filter", "@workspace/db", "db:migrate"], {
  cwd: ROOT,
  env,
});

rmSync(MOCK_STATE, { force: true });
start("mock", `${SCRIPTS}node_modules/.bin/tsx`, ["paystack-mock.ts"], SCRIPTS);
await waitFor(`${mockUrl}/__dev/info`, 20_000);

const db = createDb(dbUrl, { max: 1 });
await syncPlans({
  db,
  paystack: createPaystackClient({ secretKey: MOCK_KEY, baseUrl: mockUrl }),
  currencies: ["NGN"],
});
await seedDemo({
  db,
  secret: env.BETTER_AUTH_SECRET ?? "",
  baseURL: appUrl,
  users: [...DEMO_USERS, ...E2E_EXTRA_USERS],
});
log("database seeded, plans created on the mock");

start(
  "app",
  `${WEB}node_modules/.bin/next`,
  ["dev", "--turbopack", "--port", String(appPort)],
  WEB
);
log(`starting the app on ${appUrl}`);
await waitFor(`${appUrl}/sign-in`, 180_000);
// Compile the landing page before the first test's clock starts.
await waitFor(`${appUrl}/`, 180_000);

if (process.argv.includes("--serve")) {
  log(
    `ready: ${appUrl} (mock ${mockUrl}). Run \`pnpm --filter web test:e2e\`; Ctrl+C stops both.`
  );
} else {
  const playwright = spawn(
    `${WEB}node_modules/.bin/playwright`,
    ["test", ...process.argv.slice(2)],
    { cwd: WEB, env, stdio: "inherit" }
  );
  playwright.on("exit", (code) => stop(code ?? 1));
}
