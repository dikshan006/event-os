import { expect, type APIRequestContext, type Browser, type BrowserContext } from "@playwright/test";
import { PASSWORD } from "./seed";

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
  return context;
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

/** A planner asking for another studio's page is bounced to their own list. */
export async function expectBouncedFromStudioResource(
  request: APIRequestContext,
  path: string,
) {
  const { status, location } = await rawGet(request, path);
  expect(
    status,
    `${path} should redirect a foreign planner, not serve it`,
  ).toBeGreaterThanOrEqual(300);
  expect(status, `${path} should not have served 2xx`).toBeLessThan(400);
  expect(location, `${path} redirected somewhere unexpected`).toMatch(
    /\/studio\/weddings|\/login/,
  );
}
