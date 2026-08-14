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

/**
 * Check the E2E connection string here rather than letting Prisma reject it.
 *
 * `npm run build` runs `prisma migrate deploy` inside the webServer subprocess,
 * so a malformed URL surfaces as a bare `P1013: the scheme is not recognized`
 * followed by "Process from config.webServer was not able to start" — with no
 * indication of which variable was wrong or why. The value is a credential, so
 * the obvious debugging step of printing it is the one thing not to do.
 *
 * Every failure below is something a shell does to a Neon connection string on
 * the way into an environment variable, and each gets named rather than
 * summarised. Nothing prints the value itself: the message describes the shape
 * of the mistake, which is enough to fix it and useless to anyone reading a
 * terminal over your shoulder.
 */
function assertConnectionString(name: string, raw: string): string {
  const value = raw.trim();

  const complain = (why: string): never => {
    throw new Error(
      `${name} is not a usable Postgres URL — ${why}.\n` +
        `Expected it to begin with postgresql:// or postgres://.\n` +
        `Check with:  node -e 'const v=process.env.${name}; console.log(v ? "starts: " + JSON.stringify(v.slice(0,14)) + " length: " + v.length : "UNSET")'\n` +
        `That prints the scheme and nothing secret.`,
    );
  };

  if (!value) complain("it is empty or whitespace");
  if (value.startsWith("psql ")) {
    complain(
      "it begins with `psql `, so the psql command was copied from the Neon " +
        "dashboard rather than the connection string — copy the URL on its own",
    );
  }
  if (/^["']|["']$/.test(value)) {
    complain(
      "it has quote characters inside the value — the shell already strips the " +
        "outer quotes, so `export X=\"'…'\"` leaves a literal quote behind",
    );
  }
  if (value.startsWith("<") || value.includes("<neon")) {
    complain("it is still the placeholder text rather than a real URL");
  }
  /**
   * Example values that look real enough to paste.
   *
   * A documentation URL with plausible-looking host and credentials passes
   * every structural check here and then fails much later as `P1001: can't
   * reach database server`, which reads like a network problem rather than a
   * copy-paste. Named explicitly because the useful message is "this is the
   * example, not your database", and nothing else in the failure says so.
   *
   * Matched narrowly. Real Neon endpoints look like `ep-quiet-bird-a1b2c3d4`
   * and real regions like `c-4.us-east-2.aws.neon.tech`, so none of these
   * patterns can collide with a working connection string.
   */
  if (
    /(^|@|\/\/)user:pass@/.test(value) ||
    /\bep-xxx\b/.test(value) ||
    /@region\.aws\./.test(value) ||
    /\byour-?(host|db|database)\b/i.test(value)
  ) {
    complain(
      "it is the example URL from the setup instructions, not your own — copy " +
        "the connection string for your Neon e2e branch from the Neon dashboard",
    );
  }
  if (!/^postgres(ql)?:\/\//.test(value)) complain("its scheme is not recognised");
  if (!value.includes("@")) {
    complain(
      "it has no credentials section, which usually means an unquoted `&` let " +
        "the shell split the URL — wrap the whole value in single quotes",
    );
  }
  return value;
}

/**
 * One connection string, shared by the server and the tests.
 *
 * This assignment is the whole point of the block. The suite runs in two kinds
 * of process: the Next server, and Playwright's test workers — and the workers
 * talk to Postgres directly, because `seed()` creates the fixtures and several
 * tests read rows back to check what the application actually wrote.
 *
 * Putting the URL only in `webServer.env` reached the server and left the
 * workers with nothing. `assertTestDatabase()` in the seed reads `DATABASE_URL`,
 * found it unset, and refused — which surfaced as the first test of each
 * seeding file failing and the other sixteen never running, because a throwing
 * `beforeAll` fails the first test and abandons the rest.
 *
 * Assigning to `process.env` here fixes both at once: Playwright spawns workers
 * with `{ ...process.env, ...extraEnv }`, and the config is evaluated in the
 * parent before any of them start. Server and tests then cannot disagree about
 * which database they are looking at — which was the more dangerous half of the
 * bug, since they would otherwise have been silently pointed at different ones.
 */
if (process.env.E2E_DATABASE_URL) {
  const pooled = assertConnectionString("E2E_DATABASE_URL", process.env.E2E_DATABASE_URL);
  const direct = process.env.E2E_DIRECT_URL
    ? assertConnectionString("E2E_DIRECT_URL", process.env.E2E_DIRECT_URL)
    : pooled;

  process.env.DATABASE_URL = pooled;
  process.env.DIRECT_URL = direct;
} else if (!process.env.DATABASE_URL) {
  throw new Error(
    "Neither E2E_DATABASE_URL nor DATABASE_URL is set.\n" +
      "These tests seed fixtures, suspend studios and delete rows, so they need a\n" +
      "database of their own. Point E2E at the Neon e2e branch:\n\n" +
      "  read -r \"E2E_DATABASE_URL?Paste the POOLED url: \" && export E2E_DATABASE_URL\n" +
      "  read -r \"E2E_DIRECT_URL?Paste the DIRECT url: \" && export E2E_DIRECT_URL\n",
  );
}

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
    /**
     * The environment a production build demands, supplied for the test server
     * only.
     *
     * Building for production is deliberate — the `__Host-` cookie prefix, the
     * security headers and the boot-time environment guard only exist there,
     * and testing against `next dev` would pass while production behaved
     * differently. The cost is that `assertEnv()` applies its production rules
     * to a server running on a laptop, and two of them cannot be satisfied
     * honestly:
     *
     *   APP_URL is rejected when it points at localhost, because a localhost
     *   link in a real invitation email is a broken email. The suite dials
     *   localhost by necessity, so the two requirements are irreconcilable.
     *
     *   Upstash is required so that production cannot silently fall back to a
     *   per-instance limiter. There is no Redis here.
     *
     * Both are answered with values that are deliberately non-functional rather
     * than by relaxing the guard. Weakening `assertEnv()` for tests would put an
     * escape hatch in production code, and an escape hatch in production code
     * eventually gets taken.
     *
     * This block cannot reach production: Playwright reads it, Vercel never
     * does.
     */
    env: {
      /**
       * `.invalid` is reserved by RFC 2606 and can never resolve. It satisfies
       * the "not localhost" rule, and if anything ever did try to follow a link
       * built from it, the failure would be immediate and obvious rather than a
       * request quietly reaching some real host. No test asserts on this value.
       */
      APP_URL: process.env.E2E_APP_URL ?? "https://e2e.invalid",

      /**
       * Present, so the boot guard passes; unreachable, so `consume()` takes
       * the documented fallback to the in-process limiter and logs that it did.
       * That is the limiter every one of these tests has always exercised.
       *
       * Forced rather than inherited on purpose. If a real `UPSTASH_*` happened
       * to be exported in the shell, the login-throttle test would spend
       * production's rate-limit budget and leave counters behind that belong to
       * live users. Port 1 refuses instantly, so the fallback costs nothing.
       */
      UPSTASH_REDIS_REST_URL: "http://127.0.0.1:1",
      UPSTASH_REDIS_REST_TOKEN: "e2e-unreachable-on-purpose",

      /**
       * No outbound email from the test suite, ever.
       *
       * `.env` carries a real Resend key for local development, and the server
       * inherits it, so a suite that sends invitations was making live API
       * calls on every run — rejected here only because the local `EMAIL_FROM`
       * domain happens to be unverified. A verified one would have meant real
       * messages, from test fixtures, against the sending reputation of the
       * domain the product depends on.
       *
       * Empty rather than absent, and that distinction is load-bearing:
       * `@next/env` adopts a `.env` value only when the key is `undefined` in
       * the parent environment, so an empty string is what stops `.env` from
       * winning. `sendEmail` then sees no client, records the attempt as
       * SKIPPED and makes no network call — which is the mode case 13 was
       * written against, as its own comment says.
       */
      RESEND_API_KEY: "",

      /**
       * Resolved above and already on `process.env`, so `...process.env` in
       * Playwright's own spawn would carry it anyway. Repeated explicitly
       * because `npm run build` here runs `prisma migrate deploy`, and a reader
       * deciding whether this command can touch production should be able to
       * see which database it gets without tracing the file backwards.
       */
      DATABASE_URL: process.env.DATABASE_URL as string,
      DIRECT_URL: (process.env.DIRECT_URL ?? process.env.DATABASE_URL) as string,
    },
  },
});
