import { env } from "@workspace/env/server";

import { isAuthorizedCron } from "@/server/billing-routes";
import { getServerContext } from "@/server/context";

// Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Any scheduler can
// call this the same way; every step is idempotent.
export async function GET(request: Request) {
  if (!isAuthorizedCron(request, env.CRON_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const report = await getServerContext().billing.reconcile();
  return Response.json(report);
}
