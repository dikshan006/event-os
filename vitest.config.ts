import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Coverage thresholds are set on the directories that are worth a threshold.
 *
 * A global percentage across the whole repository would be a number that goes
 * up when someone deletes a page and down when someone adds one, and it would
 * be satisfied fastest by testing the easiest code rather than the code that
 * matters. `src/lib` and `src/server/services` are where tenant isolation,
 * token generation, validation and money live; those carry a real floor. The
 * pages and components are covered by build and typecheck in CI and by the
 * end-to-end path, not by a percentage.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      /**
       * `server-only` is a build-time guard: importing it from a client bundle
       * is meant to fail the build. It has no runtime, so outside Next it fails
       * to resolve and takes every module that imports it down with it. Stubbed
       * rather than removed from the source — the guard is doing real work in
       * the app, and a test runner is not a client bundle.
       */
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      include: ["src/lib/**", "src/server/services/**"],
      exclude: ["**/*.d.ts", "src/lib/db.ts"],
      thresholds: {
        "src/lib/**": { statements: 60, branches: 55, functions: 55, lines: 60 },
      },
    },
  },
});
