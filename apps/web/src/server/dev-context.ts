import "server-only";

import { getDevOutbox } from "@workspace/email";
import { env } from "@workspace/env/server";

import { getServerContext } from "./context";
import { createMockClient, type DevDeps, devToolsEnabled } from "./dev-billing";

/** True when the billing page shows the "Simulate billing" panel. */
export function isDevToolsEnabled(): boolean {
  return devToolsEnabled(env);
}

export function getDevDeps(): DevDeps {
  const { db, authService, billing } = getServerContext();
  return {
    db,
    authService,
    billing,
    enabled: isDevToolsEnabled(),
    mock: createMockClient({
      baseUrl: env.PAYSTACK_API_URL,
      secretKey: env.PAYSTACK_SECRET_KEY,
    }),
    outbox: getDevOutbox,
  };
}
