import { headers } from "next/headers";

import { handleDevOutboxEmail } from "@/server/dev-billing";
import { getDevDeps } from "@/server/dev-context";

type Params = { params: Promise<{ orgId: string; emailId: string }> };

// Development only, like ../../simulate.
export async function GET(_request: Request, { params }: Params) {
  const { orgId, emailId } = await params;
  return handleDevOutboxEmail(getDevDeps(), {
    headers: await headers(),
    organizationId: orgId,
    id: emailId,
  });
}
