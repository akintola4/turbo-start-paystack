import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export type Schema = typeof schema;

/** Driver-agnostic handle: postgres-js in the app, PGlite in tests. */
export type Database = PgDatabase<PgQueryResultHKT, Schema>;

export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Either the root handle or an open transaction. */
export type DbOrTx = Database | Transaction;

export function createDb(url: string, options?: { max?: number }): Database {
  const sqlClient = postgres(url, { max: options?.max ?? 10 });
  return drizzle(sqlClient, { schema }) as unknown as Database;
}
