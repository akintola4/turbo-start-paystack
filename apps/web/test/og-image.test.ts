import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("../src/app/opengraph-image.tsx", import.meta.url)),
  "utf8"
);

describe("opengraph image fonts", () => {
  afterEach(() => {
    vi.doUnmock("node:fs/promises");
    vi.resetModules();
  });

  it("reads no files when the module loads", async () => {
    // Page routes import this module for its metadata. A font read at
    // module scope rejected unhandled on Vercel and killed the process.
    const readFile = vi.fn(() => Promise.reject(new Error("ENOENT")));
    vi.doMock("node:fs/promises", () => ({ readFile, default: { readFile } }));
    const mod = await import("../src/app/opengraph-image");
    expect(mod.size).toEqual({ width: 1200, height: 630 });
    expect(readFile).not.toHaveBeenCalled();
    // A missing font fails the image route only, as a normal rejection.
    await expect(mod.default()).rejects.toThrow("ENOENT");
  });

  it("loads only fonts colocated with the route, so they are traced", () => {
    expect(source).not.toContain("process.cwd()");
    expect(source).not.toContain("node_modules");
    const fonts = [...source.matchAll(/new URL\("(\.\/fonts\/[^"]+)"/g)].map(
      (m) => m[1] as string
    );
    expect(fonts).toEqual([
      "./fonts/geist-400.ttf",
      "./fonts/geist-700.ttf",
      "./fonts/geist-800-latin.ttf",
      "./fonts/currency-symbols-700.ttf",
    ]);
    for (const font of fonts) {
      const url = new URL(`../src/app/${font.slice(2)}`, import.meta.url);
      expect(existsSync(fileURLToPath(url)), font).toBe(true);
    }
  });
});
