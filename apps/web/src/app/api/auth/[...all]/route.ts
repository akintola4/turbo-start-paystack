import { toNextJsHandler } from "better-auth/next-js";

import { getServerContext } from "@/server/context";

export const { GET, POST } = toNextJsHandler((request: Request) =>
  getServerContext().authService.auth.handler(request)
);
