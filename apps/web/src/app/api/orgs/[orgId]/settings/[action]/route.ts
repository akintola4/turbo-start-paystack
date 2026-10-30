import { headers } from "next/headers";

import { getServerContext } from "@/server/context";
import { handleOrgSettings } from "@/server/org-settings";

type Params = { params: Promise<{ orgId: string; action: string }> };

export async function POST(request: Request, { params }: Params) {
  const { orgId, action } = await params;
  return handleOrgSettings(getServerContext(), {
    headers: await headers(),
    organizationId: orgId,
    action,
    body: await request.json().catch(() => ({})),
    contentType: request.headers.get("content-type"),
  });
}
