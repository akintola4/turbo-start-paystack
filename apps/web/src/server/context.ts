import "server-only";

import { createAuth } from "@workspace/auth/server";
import { createDb, type Database } from "@workspace/db";
import { createEmailSender } from "@workspace/email";
import { env } from "@workspace/env/server";

type ServerContext = {
  db: Database;
  authService: ReturnType<typeof createAuth>;
};

const globalForContext = globalThis as unknown as {
  __serverContext?: ServerContext;
};

/** Process-wide singletons (one DB pool, one Better Auth instance). Cached on
 *  globalThis so dev hot reloads don't open a new pool each time. */
export function getServerContext(): ServerContext {
  if (globalForContext.__serverContext) {
    return globalForContext.__serverContext;
  }
  const db = createDb(env.DATABASE_URL);
  const sendEmail = createEmailSender({
    from: env.EMAIL_FROM,
    resendApiKey: env.RESEND_API_KEY,
  });
  const authService = createAuth({
    db,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    sendEmail,
  });
  const context = { db, authService };
  globalForContext.__serverContext = context;
  return context;
}
