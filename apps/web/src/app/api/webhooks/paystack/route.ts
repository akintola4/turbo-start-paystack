import { env } from "@workspace/env/server";
import { after } from "next/server";

import { handlePaystackWebhook } from "@/server/billing-routes";
import { getServerContext } from "@/server/context";

export async function POST(request: Request) {
  return handlePaystackWebhook(getServerContext(), {
    request,
    secretKey: env.PAYSTACK_SECRET_KEY,
    enforceIpAllowlist: env.PAYSTACK_WEBHOOK_IP_ALLOWLIST,
    // Respond 200 first; process once the response is sent. Failures are
    // recorded on the event and retried by /api/cron/billing-reconcile.
    schedule: (task) => after(task),
  });
}
