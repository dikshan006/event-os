import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Coverage thresholds are per module, and every number is one that was measured
 * before it was written down.
 *
 * The first version set a 60% floor across all of `src/lib`. That was a wish,
 * not a measurement — the real figure is about 19%, because `src/lib` also
 * holds the email renderer, the image pipeline and the storage adapters, none
 * of which have unit tests and several of which need a network or a native
 * binary to exercise properly. CI failed on it immediately, which is the right
 * outcome for a false claim but a poor use of everyone's afternoon.
 *
 * A threshold you do not meet is worse than no threshold: it fails the build
 * for a reason unrelated to the change being built, and the fix people reach
 * for is to lower it, which teaches everyone that the number is decorative.
 *
 * So the floors sit on the modules the tests genuinely cover — the ones where a
 * regression means a leaked secret, a broken tenant boundary or an open login
 * form — set a little below the current measurement so ordinary refactoring has
 * room. `include` stays broad on purpose: the summary should keep reporting the
 * untested files, because that is information, not noise.
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
      reporter: ["text-summary", "json-summary", "lcov"],
      include: ["src/lib/**", "src/server/services/**"],
      exclude: ["**/*.d.ts", "src/lib/db.ts", "src/lib/demo-*.ts", "src/lib/timezone-lookup.ts"],
      thresholds: {
        // Secrets must never reach a log drain.
        "src/lib/logger.ts": { statements: 90, lines: 90, branches: 60 },
        // The login form's only defence against guessing and stuffing.
        "src/lib/lockout.ts": { statements: 80, lines: 80, branches: 90 },
        // Retry, backoff and graceful degradation.
        "src/lib/monitoring.ts": { statements: 90, lines: 90, branches: 70 },
        // Invite codes and slugs — entropy and containment.
        "src/lib/utils.ts": { statements: 80, lines: 80 },
        // Every server action parses through these.
        "src/lib/validators.ts": { statements: 85, lines: 85 },
        /**
         * Low on purpose. Only the in-memory fallback runs here; the Redis path
         * needs an Upstash endpoint, so exercising it belongs to an integration
         * job with a service container rather than to a unit run that would
         * have to mock `fetch` and then be asserting on the mock.
         */
        "src/lib/ratelimit.ts": { statements: 40, lines: 40, branches: 60 },
      },
    },
  },
});
