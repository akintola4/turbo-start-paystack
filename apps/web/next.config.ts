import "@workspace/env/client";
import "@workspace/env/server";

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";

import { emailAssetHeaders } from "./src/lib/email-assets";
import { API_CSP, staticSecurityHeaders } from "./src/lib/security-headers";

/**
 * Build info for the footer: the version from the root package.json and the
 * date of the last commit. Both fall back quietly (no git in the build
 * image, or a missing file), and the footer then leaves the date out.
 */
function buildInfo() {
  let version = "";
  try {
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), "../../package.json"), "utf8")
    ) as { version?: string };
    version = pkg.version ?? "";
  } catch {
    // Not in the monorepo layout; leave it to the fallback.
  }
  let updated = process.env.LAST_UPDATED ?? "";
  if (!updated) {
    try {
      updated = execFileSync("git", ["log", "-1", "--format=%cI"], {
        stdio: ["ignore", "pipe", "ignore"],
      })
        .toString()
        .trim();
    } catch {
      // No git history available (e.g. a source-only deploy).
    }
  }
  return { version, updated };
}

const build = buildInfo();

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui"],
  typedRoutes: false,
  poweredByHeader: false,
  // Server-side PDF rendering (invoice download), kept out of the bundle.
  // Its fonts sit next to server/invoice-pdf.tsx and are traced from there.
  serverExternalPackages: ["@react-pdf/renderer"],
  headers: async () => [
    {
      source: "/:path*",
      headers: staticSecurityHeaders({
        production: process.env.NODE_ENV === "production",
      }),
    },
    // Pages get a nonce CSP from src/proxy.ts. API responses get a deny-all
    // one, except the dev outbox's email preview, which sets its own.
    {
      source: "/api/:path((?!dev/orgs/[^/]+/outbox/).*)",
      headers: [{ key: "Content-Security-Policy", value: API_CSP }],
    },
    // Fonts and icons that transactional emails load from the app.
    ...emailAssetHeaders(),
  ],
  env: {
    NEXT_PUBLIC_APP_VERSION: build.version,
    NEXT_PUBLIC_LAST_UPDATED: build.updated,
  },
};

export default nextConfig;
