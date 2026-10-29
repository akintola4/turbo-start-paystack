import { headers } from "next/headers";

import { handleDevSimulate } from "@/server/dev-billing";
import { getDevDeps } from "@/server/dev-context";

type Params = { params: Promise<{ orgId: string }> };

// Development only: 404 unless NODE_ENV is not production and
// PAYSTACK_API_URL is the local mock (see src/server/dev-billing.ts).
export async function POST(request: Request, { params }: Params) {
  const { orgId } = await params;
  return handleDevSimulate(getDevDeps(), {
    headers: await headers(),
    organizationId: orgId,
    body: await request.json().catch(() => ({})),
    contentType: request.headers.get("content-type"),
  });
}
