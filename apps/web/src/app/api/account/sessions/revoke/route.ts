import { headers } from "next/headers";

import { handleRevokeSession } from "@/server/account";
import { getServerContext } from "@/server/context";

export async function POST(request: Request) {
  return handleRevokeSession(getServerContext(), {
    headers: await headers(),
    body: await request.json().catch(() => ({})),
    contentType: request.headers.get("content-type"),
  });
}
