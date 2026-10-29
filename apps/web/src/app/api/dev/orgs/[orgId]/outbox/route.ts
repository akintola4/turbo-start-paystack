import { headers } from "next/headers";

import { handleDevOutbox } from "@/server/dev-billing";
import { getDevDeps } from "@/server/dev-context";

type Params = { params: Promise<{ orgId: string }> };

// Development only, like ../simulate.
export async function GET(_request: Request, { params }: Params) {
  const { orgId } = await params;
  return handleDevOutbox(getDevDeps(), {
    headers: await headers(),
    organizationId: orgId,
  });
}
