import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const src = fileURLToPath(new URL("../src", import.meta.url));

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory()
      ? files(path)
      : /\.tsx?$/.test(name)
        ? [path]
        : [];
  });
}

describe("one name for signing out", () => {
  it("says Sign out everywhere, never Log out", () => {
    // Search keywords may still match "log out"; visible copy may not.
    const offenders = files(src).filter((file) =>
      /Log out/.test(readFileSync(file, "utf8"))
    );
    expect(offenders).toEqual([]);
  });
});
