import "@workspace/env/client";
import "@workspace/env/server";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui"],
  typedRoutes: false,
  poweredByHeader: false,
};

export default nextConfig;
