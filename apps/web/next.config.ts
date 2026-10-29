import "@workspace/env/client";
import "@workspace/env/server";

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { NextConfig } from "next";

import { emailAssetHeaders } from "./src/lib/email-assets";

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
  // Fonts and icons that transactional emails load from the app.
  headers: async () => emailAssetHeaders(),
  env: {
    NEXT_PUBLIC_APP_VERSION: build.version,
    NEXT_PUBLIC_LAST_UPDATED: build.updated,
  },
};

export default nextConfig;
