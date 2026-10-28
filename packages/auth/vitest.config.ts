import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // PGlite boot + password hashing make setup slower than a unit test.
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
