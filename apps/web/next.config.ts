import "@workspace/env/client";
import "@workspace/env/server";

import type { NextConfig } from "next";

import { emailAssetHeaders } from "./src/lib/email-assets";

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui"],
  typedRoutes: false,
  poweredByHeader: false,
  // Fonts and icons that transactional emails load from the app.
  headers: async () => emailAssetHeaders(),
};

export default nextConfig;
