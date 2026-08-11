import { defineConfig } from "@playwright/test";

/**
 * End-to-end security tests.
 *
 * These exist to cover the one thing the 86 unit and service tests cannot: the
 * integration seam. Those tests call services directly against a fake Prisma
 * client, which proves the WHERE clauses are right but says nothing about
 * whether the route in front of a service actually reaches it with the session
 * the service expects. A tenancy check that is correct in `guests.ts` and
 * skipped by the page that calls it looks identical from a unit test.
 *
 * So every test here drives a real HTTP request against a real server with a
 * real session cookie, and asserts on status and redirect rather than on
 * markup — selectors break when the design changes and these should not.
 *
 * Serial, single worker, one shared database. The suite seeds two studios and
 * mutates sessions and rate-limit counters; running it in parallel would have
 * tests invalidating each other's sessions.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  // Authorization boundaries are not flaky. A retry here would hide a real
  // intermittent failure, which is exactly the kind worth seeing.
  retries: 0,
  workers: 1,
  fullyParallel: false,
  timeout: 30_000,
  reporter: process.env.CI ? "list" : "line",
  use: {
    baseURL: BASE_URL,
    // Redirects are the assertion in most of these tests — `ownWedding`
    // redirects rather than 403ing so existence never leaks — so the client
    // must not follow them silently.
    extraHTTPHeaders: { "accept-language": "en-US" },
    trace: "retain-on-failure",
  },
  webServer: {
    /**
     * Production build, not `next dev`.
     *
     * Three of the controls under test only exist in production: the `__Host-`
     * cookie prefix, the environment guard that refuses to boot without a
     * shared rate-limit store, and the security headers Next applies from
     * `next.config.mjs`. Testing against `next dev` would pass while production
     * behaved differently, which is the failure mode this suite is for.
     */
    command: `npm run build && npx next start -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
