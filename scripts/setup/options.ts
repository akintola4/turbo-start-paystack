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
};

export class OptionError extends Error {}

const truthy = (value: string | undefined) =>
  value !== undefined && value !== "" && value !== "0" && value !== "false";

function flagValue(argv: string[], name: string): string | undefined {
  return argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
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
  const databaseUrl = env.DATABASE_URL?.trim() || undefined;
  if (databaseUrl && !/^postgres(ql)?:\/\//.test(databaseUrl)) {
    throw new OptionError(
      "DATABASE_URL must start with postgres:// or postgresql://."
    );
  }
  const appPort = port(
    flagValue(argv, "port") ?? env.SETUP_PORT,
    "--port / SETUP_PORT"
  );
  const mockPort = port(
    flagValue(argv, "mock-port") ?? env.SETUP_MOCK_PORT,
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
  };
}
