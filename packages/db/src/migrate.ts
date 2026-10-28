import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is required to run migrations");
}

const sqlClient = postgres(url, { max: 1 });
await migrate(drizzle(sqlClient), {
  migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
});
await sqlClient.end();
process.stdout.write("migrations applied\n");
