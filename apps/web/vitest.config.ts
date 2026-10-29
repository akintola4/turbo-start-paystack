import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig keeps JSX for Next (`preserve`); tests render the invoice PDF.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    exclude: ["e2e/**", "node_modules/**"],
    // PGlite boot + password hashing make setup slower than a unit test.
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
