import { fileURLToPath } from "node:url";
import postgres from "postgres";

import { RunError, runGroup } from "./run";

export const DEFAULT_PG_PORT = 54329;

export function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

export function databaseOf(url: string): string {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
}

function client(url: string) {
  return postgres(url, {
    max: 1,
    connect_timeout: 3,
    idle_timeout: 1,
    onnotice: () => undefined,
  });
}

/** Connects and runs `select 1`. */
export async function canConnect(url: string): Promise<boolean> {
  const sql = client(url);
  try {
    await sql`select 1`;
    return true;
  } catch {
    return false;
  } finally {
    await sql.end({ timeout: 1 }).catch(() => undefined);
  }
}

/** A Postgres on 127.0.0.1:port we can log in to as `postgres` (trust, or
 *  the Docker image's default password). Returns its maintenance URL. */
export async function findServer(port: number): Promise<string | null> {
  for (const auth of ["postgres", "postgres:postgres"]) {
    const url = `postgres://${auth}@127.0.0.1:${port}/postgres`;
    if (await canConnect(url)) {
      return url;
    }
  }
  return null;
}

const DEV_DB_SCRIPT = fileURLToPath(new URL("../dev-db.sh", import.meta.url));

/** Starts or reuses the dev server through scripts/dev-db.sh. */
export async function startServer(input: {
  port: number;
  database: string;
}): Promise<{ url: string; via: "docker" | "local" }> {
  // A first Docker run pulls the image, so allow a few minutes, but never
  // wait forever on a daemon that stopped answering.
  const { stdout } = await runGroup("bash", [DEV_DB_SCRIPT], {
    env: {
      ...process.env,
      PGPORT: String(input.port),
      PGDATABASE: input.database,
    },
    timeoutMs: 300_000,
  }).catch((error: unknown) => {
    if (error instanceof RunError && error.killed) {
      throw new Error(
        "scripts/dev-db.sh did not start Postgres within 5 minutes. Set DATABASE_URL to a running Postgres instead."
      );
    }
    if (error instanceof RunError) {
      throw new Error(`scripts/dev-db.sh failed:\n${error.stderr.trim()}`);
    }
    throw error;
  });
  const line = stdout.split("\n").find((l) => l.startsWith("DATABASE_URL="));
  if (!line) {
    throw new Error(`dev-db.sh printed no DATABASE_URL:\n${stdout}`);
  }
  return {
    url: line.slice("DATABASE_URL=".length).trim(),
    via: stdout.includes("docker stop") ? "docker" : "local",
  };
}

async function withAdmin<T>(
  url: string,
  fn: (sql: ReturnType<typeof client>) => Promise<T>
): Promise<T> {
  const sql = client(withDatabase(url, "postgres"));
  try {
    return await fn(sql);
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}

/** Creates the database in `url` if it doesn't exist. True if created. */
export function ensureDatabase(url: string): Promise<boolean> {
  const name = databaseOf(url);
  return withAdmin(url, async (sql) => {
    const [row] = await sql`select 1 from pg_database where datname = ${name}`;
    if (row) {
      return false;
    }
    await sql.unsafe(`create database "${name.replaceAll('"', '""')}"`);
    return true;
  });
}

/** Drops the database in `url` (closing its connections). */
export function dropDatabase(url: string): Promise<void> {
  const name = databaseOf(url);
  return withAdmin(url, async (sql) => {
    await sql.unsafe(
      `drop database if exists "${name.replaceAll('"', '""')}" with (force)`
    );
  });
}
