import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { migrate as migratePg } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import type { Database } from "./client";
import * as schema from "./schema";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

/** In-process Postgres (PGlite) with every migration applied. One per test
 *  file is cheap enough; call `close()` in `afterAll`. */
export async function createTestDb(): Promise<{
  db: Database;
  close: () => Promise<void>;
}> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  return {
    db: db as unknown as Database,
    close: () => client.close(),
  };
}

/**
 * A throwaway database on a real Postgres server (for concurrency tests that
 * PGlite's single connection can't exercise). `adminUrl` must be able to
 * CREATE DATABASE. The database is dropped on `close()`.
 */
export async function createPgTestDb(adminUrl: string): Promise<{
  db: Database;
  close: () => Promise<void>;
}> {
  const name = `tsp_test_${Math.random().toString(36).slice(2, 10)}`;
  const admin = postgres(adminUrl, { max: 1 });
  await admin.unsafe(`create database ${name}`);
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  const client = postgres(url.toString(), {
    max: 10,
    onnotice: () => undefined,
  });
  const db = drizzlePg(client, { schema });
  await migratePg(db, { migrationsFolder });
  return {
    db: db as unknown as Database,
    close: async () => {
      await client.end();
      await admin.unsafe(`drop database if exists ${name} with (force)`);
      await admin.end();
    },
  };
}
