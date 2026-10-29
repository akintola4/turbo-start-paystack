// pnpm setup            (or: pnpm run setup -- [--reset] [--db=<name>] [--yes])
// pnpm setup:reset      drop and reseed the dev database
// SETUP_DB=<name> pnpm setup   use another database name
//
// pnpm has a built-in `setup` command: `pnpm setup` runs this script, but
// pnpm rejects flags after it, hence setup:reset and SETUP_DB.
// One command from a fresh clone to a running local stack: checks the
// prerequisites, fills apps/web/.env (never overwriting a value), picks free
// ports, starts or reuses Postgres, migrates, creates the plans on the local
// Paystack mock and seeds a demo organization you can sign in to. Safe to
// run again. --reset drops and recreates the dev database first.
import { execFile, spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import * as p from "@clack/prompts";
import {
  type Currency,
  createPaystackClient,
  isCurrency,
  syncPlans,
} from "@workspace/billing";
import { createDb } from "@workspace/db";
import pc from "picocolors";

import {
  applyEnv,
  generateSecrets,
  isPlaceholder,
  parseEnv,
  planEnv,
  SECRET_KEYS,
} from "./setup/env-file";
import { isListening, isPortFree, pickPort, portOf } from "./setup/ports";
import {
  canConnect,
  DEFAULT_PG_PORT,
  databaseOf,
  dropDatabase,
  ensureDatabase,
  findServer,
  startServer,
  withDatabase,
} from "./setup/postgres";
import { DEMO_ORG, DEMO_PASSWORD, DEMO_USERS, seedDemo } from "./setup/seed";

const execFileAsync = promisify(execFile);
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCRIPTS = fileURLToPath(new URL(".", import.meta.url));
const ENV_PATH = `${ROOT}apps/web/.env`;
const EXAMPLE_PATH = `${ROOT}.env.example`;
const MOCK_STATE = `${SCRIPTS}.paystack-mock.json`;
const MOCK_KEY = "sk_test_local_mock";
const DEFAULT_DB = "turbo_start_paystack";

const argv = process.argv.slice(2);
const flags = {
  reset: argv.includes("--reset"),
  yes: argv.includes("--yes") || argv.includes("-y"),
  db: argv.find((a) => a.startsWith("--db="))?.slice(5) || process.env.SETUP_DB,
};
const interactive = Boolean(process.stdout.isTTY && process.stdin.isTTY);
const c = pc.createColors(
  Boolean(process.stdout.isTTY) && !process.env.NO_COLOR
);
const started = performance.now();

class SetupError extends Error {
  constructor(
    message: string,
    readonly fix?: string[]
  ) {
    super(message);
  }
}

function fail(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  p.log.error(c.red(message));
  if (error instanceof SetupError && error.fix?.length) {
    p.note(error.fix.join("\n"), c.yellow("Fix"));
  }
  p.outro(
    `${c.red("Setup stopped.")}  ${c.dim("Fix the above and run it again; it picks up where it left off.")}`
  );
  process.exit(1);
}

async function step<T>(
  start: string,
  run: () => Promise<T>,
  done: (value: T) => string
): Promise<T> {
  // Without a terminal (CI, piped logs) a spinner prints every frame as a
  // new line; write one line per step instead.
  if (!process.stdout.isTTY) {
    p.log.step(start);
    try {
      const value = await run();
      p.log.success(done(value));
      return value;
    } catch (error) {
      fail(error);
    }
  }
  const s = p.spinner();
  s.start(start);
  try {
    const value = await run();
    s.stop(done(value));
    return value;
  } catch (error) {
    s.error(c.red(start));
    fail(error);
  }
}

// ------------------------------------------------------------ prerequisites

type Tools = {
  node: string;
  pnpm: string | null;
  docker: boolean;
  local: boolean;
};

function has(cmd: string, args: string[] = ["--version"]) {
  const r = spawnSync(cmd, args, { stdio: "pipe", encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}

function checkTools(): Tools {
  const tools: Tools = {
    node: process.versions.node,
    pnpm: has("pnpm", ["-v"]),
    docker: has("docker", ["info", "--format", "{{.ServerVersion}}"]) !== null,
    local: has("initdb") !== null && has("pg_ctl") !== null,
  };
  const fixes: string[] = [];
  if (Number(tools.node.split(".")[0]) < 24) {
    fixes.push(
      `Node ${tools.node} is too old; this repo needs 24+.`,
      `  ${c.cyan("nvm install 24 && nvm use 24")}  (or fnm, volta, nodejs.org)`
    );
  }
  if (!tools.pnpm) {
    fixes.push(
      "pnpm is not on your PATH.",
      `  ${c.cyan("corepack enable")}  (picks up the version in package.json)`
    );
  }
  if (fixes.length) {
    throw new SetupError("Missing prerequisites", fixes);
  }
  return tools;
}

const postgresFix = [
  "Postgres is needed, from any of:",
  `  Docker:  start Docker Desktop (or ${c.cyan("sudo systemctl start docker")})`,
  `  macOS:   ${c.cyan("brew install postgresql@17 && brew link postgresql@17")}`,
  `  Linux:   ${c.cyan("sudo apt install postgresql")}  (initdb/pg_ctl live in /usr/lib/postgresql/*/bin)`,
  `  Or set DATABASE_URL in apps/web/.env to any Postgres 15+ and run setup again.`,
];

// ------------------------------------------------------------------ mock

async function mockInfo(port: number) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/__dev/info`, {
      signal: AbortSignal.timeout(800),
    });
    return res.ok
      ? ((await res.json()) as { mock: string; webhookUrl: string })
      : null;
  } catch {
    return null;
  }
}

async function withMock<T>(
  env: Map<string, string>,
  port: number,
  run: () => Promise<T>
): Promise<{ value: T; reused: boolean }> {
  const webhookUrl = env.get("PAYSTACK_MOCK_WEBHOOK_URL");
  const info = await mockInfo(port);
  if (info && info.webhookUrl === webhookUrl) {
    return { value: await run(), reused: true };
  }
  if (!(await isPortFree(port))) {
    throw new SetupError(
      `Port ${port} (the Paystack mock) is in use by something else.`,
      [
        `Stop that process, or set PAYSTACK_API_URL, PAYSTACK_MOCK_PORT and`,
        `PAYSTACK_MOCK_WEBHOOK_URL in apps/web/.env to a free port.`,
      ]
    );
  }
  const child = spawn(`${SCRIPTS}node_modules/.bin/tsx`, ["paystack-mock.ts"], {
    cwd: SCRIPTS,
    env: {
      ...process.env,
      ...Object.fromEntries(env),
      NODE_ENV: "development",
    },
    stdio: "ignore",
  });
  try {
    const deadline = Date.now() + 20_000;
    while (!(await mockInfo(port))) {
      if (Date.now() > deadline || child.exitCode !== null) {
        throw new SetupError("The Paystack mock did not start.", [
          `Run it by hand to see why: ${c.cyan("pnpm paystack:mock")}`,
        ]);
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    return { value: await run(), reused: false };
  } finally {
    child.kill("SIGTERM");
  }
}

// ------------------------------------------------------------------- main

p.intro(`${c.bgCyan(c.black(" turbo-start "))} ${c.dim("local setup")}`);

const tools = await step(
  "Checking prerequisites",
  async () => checkTools(),
  (t) =>
    `Node ${c.dim(t.node)} · pnpm ${c.dim(t.pnpm ?? "")} · ${
      t.docker
        ? `Docker ${c.dim("available")}`
        : t.local
          ? `initdb/pg_ctl ${c.dim("available")}`
          : c.yellow("no Docker or local Postgres")
    }`
);

// --------------------------------------------------------------- env file

const fresh = !existsSync(ENV_PATH);
const template = readFileSync(EXAMPLE_PATH, "utf8");
const text = fresh ? template : readFileSync(ENV_PATH, "utf8");
const current = parseEnv(text);
const exampleDbUrl = parseEnv(template).get("DATABASE_URL");
if (current.get("DATABASE_URL") === exampleDbUrl) {
  current.delete("DATABASE_URL");
}
// Values copied from the template in this run are ours to replace.
const force = new Set<string>(
  fresh ? ["BETTER_AUTH_URL", "NEXT_PUBLIC_APP_URL"] : []
);
const secretKey = current.get("PAYSTACK_SECRET_KEY");
const realKey = !isPlaceholder(secretKey) && secretKey !== MOCK_KEY;
const configuredApi = current.get("PAYSTACK_API_URL");
const mockMode = configuredApi
  ? /^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(configuredApi)
  : !realKey;

// ------------------------------------------------------------------ ports

const ports = await step(
  "Picking ports",
  async () => {
    const keptApp = force.has("BETTER_AUTH_URL")
      ? null
      : portOf(current.get("BETTER_AUTH_URL"));
    const app = keptApp ?? (await pickPort(3000, { avoid: [3001] }));
    let mock: number | null = null;
    if (mockMode) {
      const keptMock =
        Number(current.get("PAYSTACK_MOCK_PORT")) ||
        (configuredApi ? portOf(configuredApi) : null);
      mock = keptMock ?? (await pickPort(4010, { avoid: [app, 3001] }));
    }
    return { app, mock, appKept: keptApp !== null };
  },
  (r) =>
    `app ${c.cyan(String(r.app))}${r.mock ? ` · mock ${c.cyan(String(r.mock))}` : ""}`
);
const appUrl = `http://localhost:${ports.app}`;
if (ports.appKept && !(await isPortFree(ports.app))) {
  p.log.warn(
    `Port ${ports.app} (from BETTER_AUTH_URL) is in use right now. ${c.dim("If that isn't this app, change BETTER_AUTH_URL before pnpm dev.")}`
  );
}

// --------------------------------------------------------------- postgres

const database = await step(
  "Starting Postgres",
  async () => {
    const kept = current.get("DATABASE_URL");
    const name = flags.db ?? (kept ? databaseOf(kept) : DEFAULT_DB);
    if (kept) {
      const url = flags.db ? withDatabase(kept, flags.db) : kept;
      if (await canConnect(withDatabase(url, "postgres"))) {
        return { url, how: "from apps/web/.env" };
      }
      const host = new URL(url).hostname;
      if (!["localhost", "127.0.0.1"].includes(host)) {
        throw new SetupError(
          `Can't reach the Postgres in DATABASE_URL (${host}).`,
          ["Check the URL and that the server is up, then run setup again."]
        );
      }
      if (!(tools.docker || tools.local)) {
        throw new SetupError(
          "DATABASE_URL points at a local Postgres that is not running.",
          postgresFix
        );
      }
      const started = await startServer({
        port: portOf(url) ?? DEFAULT_PG_PORT,
        database: name,
      });
      return {
        url: withDatabase(started.url, name),
        how: `started (${started.via})`,
      };
    }
    for (let port = DEFAULT_PG_PORT; port < DEFAULT_PG_PORT + 20; port++) {
      if (await isListening(port)) {
        const server = await findServer(port);
        if (server) {
          return { url: withDatabase(server, name), how: `reused on :${port}` };
        }
        continue;
      }
      if (!(tools.docker || tools.local)) {
        throw new SetupError(
          "No Postgres found and none can be started.",
          postgresFix
        );
      }
      const started = await startServer({ port, database: name });
      return {
        url: withDatabase(started.url, name),
        how: `started (${started.via}) on :${port}`,
      };
    }
    throw new SetupError(
      "No usable port for Postgres near 54329.",
      postgresFix
    );
  },
  (d) => `Postgres ${c.dim(d.how)}`
);

if (flags.reset) {
  if (
    (await isListening(ports.app)) ||
    (ports.mock !== null && (await mockInfo(ports.mock)))
  ) {
    fail(
      new SetupError("--reset needs the app and the mock stopped.", [
        "Stop `pnpm dev` (Ctrl+C), then run `pnpm setup:reset` again.",
      ])
    );
  }
  const name = databaseOf(database.url);
  if (interactive && !flags.yes) {
    const ok = await p.confirm({
      message: `Drop database ${c.cyan(name)} and reseed it?`,
      initialValue: false,
    });
    if (p.isCancel(ok) || !ok) {
      p.cancel("Nothing was dropped.");
      process.exit(0);
    }
  }
  await step(
    `Dropping ${name}`,
    async () => {
      await dropDatabase(database.url);
      rmSync(MOCK_STATE, { force: true });
    },
    () => `Dropped ${c.cyan(name)} and the mock's saved state`
  );
}

const createdDb = await step(
  "Creating the database",
  () => ensureDatabase(database.url),
  (created) =>
    `Database ${c.cyan(databaseOf(database.url))} ${created ? c.green("created") : c.dim("exists")}`
);

// ------------------------------------------------------------- write .env

const secrets = generateSecrets();
const desired: Record<string, string> = {
  DATABASE_URL: database.url,
  BETTER_AUTH_URL: appUrl,
  NEXT_PUBLIC_APP_URL: appUrl,
  ...secrets,
  EMAIL_FROM: "Turbo Start <billing@turbo-start.test>",
};
if (mockMode && ports.mock) {
  Object.assign(desired, {
    PAYSTACK_SECRET_KEY: MOCK_KEY,
    PAYSTACK_API_URL: `http://localhost:${ports.mock}`,
    PAYSTACK_MOCK_PORT: String(ports.mock),
    PAYSTACK_MOCK_WEBHOOK_URL: `${appUrl}/api/webhooks/paystack`,
  });
  // A pk_test_ key would load Paystack's real popup, which the mock can't serve.
  if (isPlaceholder(current.get("NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY"))) {
    desired.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY = "";
  }
}
if (!current.has("DATABASE_URL")) {
  force.add("DATABASE_URL");
}
if (flags.db) {
  force.add("DATABASE_URL");
}
const plan = planEnv(current, desired, force);
const finalText = applyEnv(text, plan.updates);
if (fresh || finalText !== text) {
  writeFileSync(ENV_PATH, finalText, { mode: 0o600 });
}
const env = parseEnv(finalText);
const filled = Object.keys(plan.updates);
const generated = filled.filter((k) => SECRET_KEYS.has(k)).length;
p.log.success(
  `${fresh ? "Created" : filled.length ? "Updated" : "Kept"} ${c.cyan("apps/web/.env")}${
    filled.length
      ? ` · filled ${filled.length}${generated ? ` (${generated} secrets generated)` : ""}`
      : c.dim(" · nothing to fill")
  }${plan.kept.length ? c.dim(` · kept ${plan.kept.length} existing`) : ""}`
);
const webhookPort = portOf(env.get("PAYSTACK_MOCK_WEBHOOK_URL"));
if (
  mockMode &&
  webhookPort !== null &&
  webhookPort !== portOf(env.get("BETTER_AUTH_URL"))
) {
  p.log.warn(
    `PAYSTACK_MOCK_WEBHOOK_URL (port ${webhookPort}) doesn't match BETTER_AUTH_URL. ${c.dim("The mock's webhooks won't reach the app.")}`
  );
}

// ------------------------------------------------------- migrate, plans

const dbUrl = env.get("DATABASE_URL") ?? database.url;
await step(
  "Applying migrations",
  async () => {
    try {
      await execFileAsync("pnpm", ["--filter", "@workspace/db", "db:migrate"], {
        cwd: ROOT,
        env: { ...process.env, DATABASE_URL: dbUrl },
      });
    } catch (error) {
      const stderr = (error as { stderr?: string }).stderr ?? "";
      throw new SetupError(
        "Migrations failed.",
        stderr.trim().split("\n").slice(-8)
      );
    }
  },
  () => `Migrations ${c.green("applied")}`
);

if (mockMode && ports.mock) {
  await step(
    "Creating plans on the Paystack mock",
    async () => {
      const { value } = await withMock(env, ports.mock as number, async () => {
        const db = createDb(dbUrl, { max: 1 });
        const currencies = (env.get("BILLING_CURRENCY") || "NGN")
          .split(",")
          .map((x) => x.trim().toUpperCase())
          .filter((x): x is Currency => isCurrency(x));
        return syncPlans({
          db,
          paystack: createPaystackClient({
            secretKey: env.get("PAYSTACK_SECRET_KEY") ?? MOCK_KEY,
            baseUrl: env.get("PAYSTACK_API_URL") ?? "",
          }),
          currencies,
        });
      });
      return value;
    },
    (r) =>
      `Plans ${r.created.length ? c.green(`${r.created.length} created`) : ""}${
        r.created.length && (r.adopted.length || r.unchanged.length) ? ", " : ""
      }${r.adopted.length + r.unchanged.length ? c.dim(`${r.adopted.length + r.unchanged.length} already there`) : ""}`
  );
} else {
  p.log.info(
    `Real Paystack keys found, so the mock is off. ${c.dim("Create the plans with")} pnpm billing:sync`
  );
}

const seeded = await step(
  "Seeding the demo organization",
  () =>
    seedDemo({
      db: createDb(dbUrl, { max: 1 }),
      secret: env.get("BETTER_AUTH_SECRET") ?? "",
      baseURL: appUrl,
    }),
  (r) =>
    `${c.cyan(DEMO_ORG.name)} with ${DEMO_USERS.length} members ${
      r.createdUsers || r.createdOrg
        ? c.green("seeded")
        : c.dim("already there")
    }`
);
void seeded;
void createdDb;

// ---------------------------------------------------------------- summary

const w = Math.max(...DEMO_USERS.map((u) => u.email.length));
p.note(
  [
    c.cyan(appUrl),
    "",
    `  ${c.dim("sign in:")}   ${DEMO_USERS[0].email}`,
    `  ${c.dim("password:")}  ${DEMO_PASSWORD}`,
    "",
    ...DEMO_USERS.map((u) => `  ${u.email.padEnd(w)}  ${c.dim(u.role)}`),
    `  ${c.dim(`all in ${DEMO_ORG.name}, emails already verified`)}`,
  ].join("\n"),
  "Ready"
);
p.note(
  [
    `${c.cyan("pnpm dev")}           ${c.dim("app + Paystack mock, one terminal")}`,
    `then Billing → pick a plan → ${c.dim("Pay on the mock checkout")}`,
    `and use the ${c.cyan("Simulate billing")} panel to play renewals,`,
    `failed payments and recoveries through real webhooks.`,
  ].join("\n"),
  "Next"
);
const seconds = ((performance.now() - started) / 1000).toFixed(1);
p.outro(`${c.green("Done!")}  ${c.dim(`in ${seconds}s. Next:`)} pnpm dev`);
process.exit(0);
