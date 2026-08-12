import { expect, type APIRequestContext, type Browser, type BrowserContext } from "@playwright/test";
import { PASSWORD, EMAILS } from "./seed";

/**
 * Sign in through the real login form and return the authenticated context.
 *
 * Deliberately not a shortcut that mints a JWT directly. Half of what these
 * tests are checking lives in the sign-in path itself — the credentials
 * provider, the `jwt` callback that stamps `issuedAt`, the `__Host-` cookie
 * name that middleware has to agree with. A helper that forged a cookie would
 * skip exactly the code most worth exercising.
 */
export async function signIn(browser: Browser, email: string): Promise<BrowserContext> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await Promise.all([
    page.waitForURL(url => !url.pathname.startsWith("/login"), { timeout: 15_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.close();
  await assertSessionUsable(context, email);
  return context;
}

/**
 * Prove the session actually works before any test relies on it.
 *
 * Leaving `/login` is not proof. Against `127.0.0.1` the sign-in genuinely
 * succeeded — the server set `__Host-authjs.session-token` and redirected to
 * `/continue` — and the browser then dropped the cookie for being `Secure` on
 * plaintext http. Every later request arrived anonymous, and the tests that
 * accepted a redirect to `/login` as a pass reported green while testing
 * nothing at all.
 *
 * So every sign-in ends here: fetch a page only a signed-in planner may see
 * and require a 200. A broken cookie now fails at the helper, naming the
 * account, instead of surfacing three tests later as a mysterious 307.
 */
export async function assertSessionUsable(context: BrowserContext, email: string) {
  /**
   * Probe the tree the account is actually allowed into.
   *
   * `requireStudio()` accepts only PLANNER, so the platform admin — who has no
   * studio — is redirected away from `/studio` exactly as a stranger would be.
   * Probing there would make a perfectly good admin session look broken.
   */
  const probe = email === EMAILS.admin ? "/admin" : "/studio";
  const res = await context.request.get(probe, { maxRedirects: 0 });
  expect(
    res.status(),
    `signed in as ${email}, but ${probe} answered ${res.status()} — the session ` +
      "cookie is not reaching the server. Check that the suite is dialling " +
      "localhost rather than 127.0.0.1: the session cookie is Secure.",
  ).toBe(200);
}

/**
 * Follow no redirects and report where the server tried to send us.
 *
 * The tenancy contract is a redirect, not a 403: `ownWedding()` sends a planner
 * back to their own list when they ask for a wedding that is not theirs, so a
 * missing record and someone else's record are indistinguishable from outside.
 * Asserting on the redirect target is therefore the assertion — a test that
 * accepted "not 200" would pass just as happily against a 500.
 */
export async function rawGet(request: APIRequestContext, path: string) {
  const res = await request.get(path, { maxRedirects: 0 });
  return { status: res.status(), location: res.headers()["location"] ?? "", body: res };
}

/**
 * A planner asking for another studio's page is bounced **to their own list**.
 *
 * `/login` is explicitly not an acceptable answer, and that is the whole point
 * of this function. It used to accept either target, which meant an
 * unauthenticated caller — someone whose session cookie never arrived —
 * satisfied it just as well as a correctly-refused planner. Four tenancy tests
 * passed that way while proving nothing about tenancy.
 *
 * A redirect to `/login` now fails loudly and says why: it means the caller was
 * not signed in, so the test never reached the boundary it claims to check.
 */
export async function expectBouncedFromStudioResource(
  request: APIRequestContext,
  path: string,
) {
  const { status, location } = await rawGet(request, path);

  expect(
    location,
    `${path} redirected to /login, which means the caller had no session — ` +
      "this test did not exercise tenant isolation at all",
  ).not.toContain("/login");

  expect(
    status,
    `${path} should redirect a foreign planner, not serve it`,
  ).toBeGreaterThanOrEqual(300);
  expect(status, `${path} should not have served 2xx`).toBeLessThan(400);
  expect(
    location,
    `${path} should bounce to the planner's own wedding list`,
  ).toContain("/studio/weddings");
}

/**
 * Sign in and keep the page open.
 *
 * `signIn` above closes its page once the session cookie exists, which is right
 * for tests that only make requests. Tests that drive the interface need the
 * page itself, and re-using one page per actor is what makes a click sequence
 * read like a session rather than a series of unrelated visits.
 */
export async function signInAs(browser: Browser, email: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await Promise.all([
    page.waitForURL(url => !url.pathname.startsWith("/login"), { timeout: 15_000 }),
    page.click('button[type="submit"]'),
  ]);
  await assertSessionUsable(context, email);
  return { context, page };
}

/**
 * A Server Action cannot be invoked from outside the page that renders it.
 *
 * Next encodes an action id into the form and verifies it server-side, so a
 * hand-rolled `request.post()` at a page URL does not reach the action — it
 * renders the page again and returns 200. Several tests here originally did
 * exactly that and would have passed while proving nothing.
 *
 * The rule this file follows instead: **if the behaviour under test lives
 * behind a Server Action, drive the real control with the browser.** Where a
 * boundary genuinely cannot be reached through the UI — a planner has no route
 * to another studio's reply form — the test says so and asserts the
 * unreachability, rather than faking a POST that would never have worked.
 */
export const SERVER_ACTIONS_MUST_BE_DRIVEN_BY_UI = true;
