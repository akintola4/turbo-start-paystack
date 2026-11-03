import { readFileSync } from "node:fs";
import { join } from "node:path";

// The repo-root llms.txt (https://llmstxt.org), read at build time and served
// as a static file. `next build` runs in apps/web, as next.config.ts assumes
// for ../../package.json. The proxy skips .txt paths, and next.config.ts
// gives this response the deny-all API CSP.
export const dynamic = "force-static";

export function GET() {
  const text = readFileSync(join(process.cwd(), "../../llms.txt"), "utf8");
  return new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
