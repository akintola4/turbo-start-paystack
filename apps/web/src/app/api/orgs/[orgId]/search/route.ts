import { headers } from "next/headers";

import { getServerContext } from "@/server/context";
import { handleSearch } from "@/server/search";

type Params = { params: Promise<{ orgId: string }> };

/** The command palette's search, checked against the org in the URL. */
export async function GET(request: Request, { params }: Params) {
  const { orgId } = await params;
  return handleSearch(getServerContext(), {
    headers: await headers(),
    organizationId: orgId,
    query: new URL(request.url).searchParams.get("q") ?? "",
  });
}
