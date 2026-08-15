import { test, expect } from "@playwright/test";
import { seed, close, IDS, CODES, EMAILS } from "./seed";
import { signIn, signInAs } from "./helpers";

/**
 * The Terms and Privacy gate, proved end to end.
 *
 * `tests/legal.test.ts` establishes that the service builds the right query and
 * that `requireStudio()` redirects. That is necessary and not sufficient: it
 * says nothing about whether the gate is actually wired into the routes a
 * planner would use, or whether a route handler that does not run layouts is
 * still covered. Those are integration facts and only a real request can settle
 * them.
 *
 * The account under test — `EMAILS.unaccepted` — is seeded with no
 * LegalAcceptance rows at all. Nothing is doctored mid-run.
 */

test.beforeAll(async () => {
  await seed();
});

test.afterAll(async () => {
  await close();
});

test("24 · an un-accepted planner is bounced from the dashboard to /accept-terms", async ({ browser }) => {
  const ctx = await signIn(browser, EMAILS.unaccepted, { expectAcceptTerms: true });

  const res = await ctx.request.get("/studio", { maxRedirects: 0 });

  expect(res.status(), "the dashboard must redirect, not render").toBeGreaterThanOrEqual(300);
  expect(res.status()).toBeLessThan(400);
  expect(
    res.headers()["location"] ?? "",
    "an un-accepted planner belongs at the consent screen",
  ).toContain("/accept-terms");

  await ctx.close();
});

test("25 · direct URL navigation to a deeper planner page is blocked too", async ({ browser }) => {
  const ctx = await signIn(browser, EMAILS.unaccepted, { expectAcceptTerms: true });

  /**
   * Typing a URL rather than following a link. The gate lives in
   * `requireStudio()`, which every one of these pages calls, so there is no
   * page to arrive at by guessing an address.
   */
  for (const path of ["/studio/weddings", "/studio/settings", "/studio/billing"]) {
    const res = await ctx.request.get(path, { maxRedirects: 0 });
    expect(res.status(), `${path} must not render`).toBeGreaterThanOrEqual(300);
    expect(res.headers()["location"] ?? "", `${path} must redirect to the gate`)
      .toContain("/accept-terms");
  }

  await ctx.close();
});

test("26 · the guest CSV export is refused — the route that layouts cannot protect", async ({ browser }) => {
  const ctx = await signIn(browser, EMAILS.unaccepted, { expectAcceptTerms: true });

  /**
   * The reason this test exists as its own case.
   *
   * Every other planner surface inherits the gate through `requireStudio()`,
   * called by the studio layout and by each page. A route handler runs neither
   * — Next does not execute layouts for them — so this endpoint carries the
   * check inline. Without it, the one thing an un-accepted planner could still
   * download would be every guest's name and email address.
   */
  const res = await ctx.request.get(
    `/studio/weddings/${IDS.weddingA}/guests/export`,
    { maxRedirects: 0 },
  );

  expect(res.status(), "the CSV must be refused outright").toBe(403);

  const body = await res.text();
  expect(body, "and must not contain guest data").not.toContain("@");
  expect(body).toContain("Accept the Terms");

  await ctx.close();
});

test("27 · accepting unlocks the dashboard, and the consent is recorded", async ({ browser }) => {
  const { context, page } = await signInAs(browser, EMAILS.unaccepted, {
    expectAcceptTerms: true,
  });

  await page.goto("/accept-terms");
  await expect(page.getByRole("heading", { name: /before you get started/i })).toBeVisible();

  /**
   * The checkbox must start unchecked. Consent that arrives pre-ticked records
   * only that somebody failed to untick it.
   */
  const box = page.getByRole("checkbox");
  await expect(box, "the box must not be pre-ticked").not.toBeChecked();

  const submit = page.getByRole("button", { name: /agree and continue/i });
  await box.check();
  await Promise.all([
    page.waitForURL(url => !url.pathname.startsWith("/accept-terms"), { timeout: 20_000 }),
    submit.click(),
  ]);

  // Through the gate now.
  const res = await context.request.get("/studio", { maxRedirects: 0 });
  expect(res.status(), "the dashboard must render once accepted").toBe(200);

  // And the CSV route is open again.
  const csv = await context.request.get(`/studio/weddings/${IDS.weddingA}/guests/export`);
  expect([200, 404]).toContain(csv.status());

  await context.close();
});

test("28 · an accepted planner is never shown the gate", async ({ browser }) => {
  // Planner A is seeded with current acceptance rows, like every normal planner.
  const ctx = await signIn(browser, EMAILS.plannerA);

  const res = await ctx.request.get("/studio", { maxRedirects: 0 });
  expect(res.status(), "an accepted planner goes straight in").toBe(200);

  await ctx.close();
});

test("29 · the gate does not touch guests or the public site", async ({ browser }) => {
  /**
   * The requirement that this must not break anything public. A guest has no
   * account, is not a party to the planner's agreement, and must never meet a
   * consent screen — so these are fetched with no session at all.
   */
  const ctx = await browser.newContext();

  const invite = await ctx.request.get(`/invite/${CODES.guestA}`, { maxRedirects: 0 });
  expect(invite.status(), "a guest portal must render for a signed-out guest").toBe(200);
  expect(
    invite.headers()["location"] ?? "",
    "a guest must never be sent to the planner consent screen",
  ).not.toContain("/accept-terms");

  for (const path of ["/", "/terms", "/privacy"]) {
    const res = await ctx.request.get(path, { maxRedirects: 0 });
    expect(res.status(), `${path} must be publicly readable`).toBe(200);
  }

  await ctx.close();
});
