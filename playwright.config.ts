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

/**
 * `localhost`, never `127.0.0.1`.
 *
 * The session cookie is `__Host-authjs.session-token` with `Secure`, because
 * `NODE_ENV` is production here — which is the point of building for
 * production rather than running `next dev`. A `Secure` cookie is not stored
 * or replayed over plaintext http at a raw IP, so against `127.0.0.1` the
 * server set the cookie, the browser dropped it, and every request after
 * sign-in arrived anonymous. Five tests failed on a 307 to /login and four
 * more *passed* while proving nothing, because "redirected to /login" happened
 * to satisfy their assertion.
 *
 * Chromium treats the hostname `localhost` as a trustworthy origin and keeps
 * `Secure` cookies set over it. Nothing in the application changes: the cookie
 * name, the `Secure` flag and the `__Host-` prefix are exactly what production
 * serves over HTTPS. Only the hostname the tests dial is different.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

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
    /**
     * Never reuse a running server.
     *
     * Rate-limit counters live in the server process whenever Upstash is
     * absent or unreachable, and they outlive a test run. Reusing a warm server
     * carried the previous run's login counters into the next one and exhausted
     * the per-address budget partway through — a failure that looks like a bug
     * in whichever test happens to sign in last.
     *
     * A fresh process per run is the only way the limiter starts from zero.
     * This deliberately does not touch `IP_HARD` or any other production limit.
     */
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
