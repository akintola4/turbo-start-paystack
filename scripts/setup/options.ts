/**
 * Flags and environment for `pnpm setup`. Pure, so the rules can be tested
 * without running setup.
 *
 * pnpm 11 drops flags written after `pnpm setup` (it is also a built-in
 * command), so everything a flag can say can also be said with an
 * environment variable, and no terminal means "use the defaults".
 */

export type SetupOptions = {
  reset: boolean;
  /** Never ask: no terminal, `--yes`, `CI` or `SETUP_YES`. */
  yes: boolean;
  /** A person can answer prompts (TTY in and out, and not `yes`). */
  interactive: boolean;
  /** Database name to use instead of the one in DATABASE_URL. */
  db: string | undefined;
  /** DATABASE_URL from the environment, used when apps/web/.env has none. */
  databaseUrl: string | undefined;
  /** Fixed app port (`--port=` or SETUP_PORT) instead of the first free one. */
  appPort: number | undefined;
  /** Fixed Paystack mock port (`--mock-port=` or SETUP_MOCK_PORT). */
  mockPort: number | undefined;
  /** SETUP_ALLOW_REMOTE_DB: accept a non-local DATABASE_URL from the
   *  environment, and let --reset drop a non-local database. */
  allowRemoteDb: boolean;
};

export class OptionError extends Error {}

const truthy = (value: string | undefined) =>
  value !== undefined && value !== "" && value !== "0" && value !== "false";

const VALUE_FLAGS = ["db", "port", "mock-port"];

/** `--name=value`; an empty value counts as not given. */
function flagValue(argv: string[], name: string): string | undefined {
  return (
    argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ||
    undefined
  );
}

/** Hosts setup treats as this machine. */
export function isLocalHost(hostname: string): boolean {
  return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname);
}

/**
 * Why setup must not use this database, or null. A DATABASE_URL inherited
 * from the shell is often there for another project, so it is used only when
 * it is local, unless SETUP_ALLOW_REMOTE_DB is set. --reset drops the
 * database without asking when there is no terminal, so it never touches a
 * non-local one without the same opt-in.
 */
export function databaseRefusal(input: {
  url: string;
  fromEnvironment: boolean;
  reset: boolean;
  allowRemote: boolean;
}): string | null {
  if (input.allowRemote || isLocalHost(new URL(input.url).hostname)) {
    return null;
  }
  const host = new URL(input.url).hostname;
  if (input.fromEnvironment) {
    return `DATABASE_URL in the environment points at ${host}, not this machine. Setup migrates and seeds the database it uses, so it only takes a local one from the environment. Unset DATABASE_URL, put the URL in apps/web/.env, or set SETUP_ALLOW_REMOTE_DB=1.`;
  }
  if (input.reset) {
    return `--reset would drop the database on ${host}, which is not this machine. Set SETUP_ALLOW_REMOTE_DB=1 if you mean it.`;
  }
  return null;
}

/**
 * The demo users have a published password, so they are only ever seeded
 * into a database on this machine, never a hosted one.
 */
export function seedsDemo(url: string): boolean {
  return isLocalHost(new URL(url).hostname);
}

function port(value: string | undefined, name: string): number | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1024 || n > 65_535) {
    throw new OptionError(`${name} must be a port from 1024 to 65535.`);
  }
  return n;
}

export function parseSetupOptions(
  argv: string[],
  env: Record<string, string | undefined>,
  tty: { stdin: boolean; stdout: boolean }
): SetupOptions {
  const yes =
    argv.includes("--yes") ||
    argv.includes("-y") ||
    truthy(env.CI) ||
    truthy(env.SETUP_YES);
  for (const name of VALUE_FLAGS) {
    if (argv.includes(`--${name}`)) {
      throw new OptionError(`Write --${name}=<value>, with an equals sign.`);
    }
  }
  const databaseUrl = env.DATABASE_URL?.trim() || undefined;
  if (databaseUrl && !/^postgres(ql)?:\/\//.test(databaseUrl)) {
    throw new OptionError(
      "DATABASE_URL must start with postgres:// or postgresql://."
    );
  }
  if (databaseUrl && new URL(databaseUrl).pathname.replace(/^\//, "") === "") {
    throw new OptionError(
      "DATABASE_URL needs a database name at the end, for example postgres://user@127.0.0.1:5432/turbo_start_paystack."
    );
  }
  const appPort = port(
    flagValue(argv, "port") || env.SETUP_PORT,
    "--port / SETUP_PORT"
  );
  const mockPort = port(
    flagValue(argv, "mock-port") || env.SETUP_MOCK_PORT,
    "--mock-port / SETUP_MOCK_PORT"
  );
  if (appPort !== undefined && appPort === mockPort) {
    throw new OptionError("The app and the mock need different ports.");
  }
  return {
    reset: argv.includes("--reset"),
    yes,
    interactive: tty.stdin && tty.stdout && !yes,
    db: flagValue(argv, "db") || env.SETUP_DB || undefined,
    databaseUrl,
    appPort,
    mockPort,
    allowRemoteDb: truthy(env.SETUP_ALLOW_REMOTE_DB),
  };
}
