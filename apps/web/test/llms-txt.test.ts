import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { GET } from "../src/app/llms.txt/route";
import { config } from "../src/proxy";

const ROOT = join(process.cwd(), "../..");
const FILE = readFileSync(join(ROOT, "llms.txt"), "utf8");
const BLOB = "https://github.com/akintola4/turbo-start-paystack/blob/main/";

describe("/llms.txt", () => {
  it("serves the repo-root llms.txt as plain text", async () => {
    const res = GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await res.text()).toBe(FILE);
  });

  it("follows the llmstxt.org shape: H1, summary, then H2 link lists", () => {
    const lines = FILE.split("\n");
    expect(lines[0]).toBe("# Turbo Start Paystack");
    expect(lines.find((l) => l.startsWith(">"))).toBeDefined();
    expect(FILE.match(/^# /gm)).toHaveLength(1);
    expect(FILE).toMatch(/^## Optional$/m);
    for (const line of lines.filter((l) => l.startsWith("- "))) {
      expect(line, line).toMatch(/^- \[[^\]]+\]\(https:\/\/[^)]+\)(: .+)?$/);
    }
  });

  it("links only to files that exist in the repo", () => {
    const paths = [...FILE.matchAll(/\]\((https:\/\/[^)]+)\)/g)]
      .map((m) => m[1] as string)
      .filter((url) => url.startsWith(BLOB))
      .map((url) => url.slice(BLOB.length));
    expect(paths).toContain("AGENTS.md");
    for (const path of paths) {
      expect(existsSync(join(ROOT, path)), path).toBe(true);
    }
  });

  it("is not a page: the proxy (and its nonce CSP) skips it", () => {
    const matcher = new RegExp(`^${config.matcher[0]}$`);
    expect(matcher.test("/llms.txt")).toBe(false);
  });
});
