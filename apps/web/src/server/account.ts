import type { AuthService } from "@workspace/auth/server";
import { type Database, schema } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

type Deps = { db: Database; authService: AuthService };

const revokeBody = z.strictObject({ sessionId: z.string().min(1).max(64) });

const json = (body: unknown, status = 200) => Response.json(body, { status });

/**
 * Signs out one of the caller's own sessions by its id. The browser never
 * sees session tokens: the id is looked up among this user's sessions, and
 * anyone else's id is a 404, the same as one that doesn't exist.
 */
export async function handleRevokeSession(
  deps: Deps,
  input: { headers: Headers; body: unknown; contentType?: string | null }
): Promise<Response> {
  if (!input.contentType?.toLowerCase().startsWith("application/json")) {
    return json({ error: "unsupported_media_type" }, 415);
  }
  const current = await deps.authService.auth.api.getSession({
    headers: input.headers,
  });
  if (!current) {
    return json({ error: "Not signed in" }, 401);
  }
  const parsed = revokeBody.safeParse(input.body);
  if (!parsed.success) {
    return json({ error: "invalid_body" }, 400);
  }
  const [row] = await deps.db
    .select({ id: schema.session.id, token: schema.session.token })
    .from(schema.session)
    .where(
      and(
        eq(schema.session.id, parsed.data.sessionId),
        eq(schema.session.userId, current.user.id)
      )
    )
    .limit(1);
  if (!row) {
    return json({ error: "not_found" }, 404);
  }
  if (row.id === current.session.id) {
    return json(
      {
        error: "current_session",
        message: "That's this device. Use Sign out instead.",
      },
      400
    );
  }
  await deps.authService.auth.api.revokeSession({
    headers: input.headers,
    body: { token: row.token },
  });
  return json({ ok: true });
}
