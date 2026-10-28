import { headers } from "next/headers";

import { handleBillingAction } from "@/server/billing-routes";
import { getServerContext } from "@/server/context";

type Params = { params: Promise<{ orgId: string; action: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { orgId, action } = await params;
  if (action !== "status") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 });
  }
  return handleBillingAction(getServerContext(), {
    headers: await headers(),
    organizationId: orgId,
    action,
    body: {},
  });
}

export async function POST(request: Request, { params }: Params) {
  const { orgId, action } = await params;
  const body = await request.json().catch(() => ({}));
  return handleBillingAction(getServerContext(), {
    headers: await headers(),
    organizationId: orgId,
    action,
    body,
    contentType: request.headers.get("content-type"),
  });
}
