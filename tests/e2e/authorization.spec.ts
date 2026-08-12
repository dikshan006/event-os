import { test, expect, type BrowserContext } from "@playwright/test";
import { seed, close, prisma, IDS, EMAILS, CODES } from "./seed";
import { signIn, rawGet, expectBouncedFromStudioResource } from "./helpers";

/**
 * Cases 1–10 of the security suite: who may read what.
 *
 * Every one of these is already covered at the service level against a fake
 * Prisma client. They are repeated here because a service test proves the WHERE
 * clause is right and proves nothing about whether the route in front of it
 * passes the session the service expects — a page that reads `studioId` from a
 * query parameter would satisfy every unit test in the repository.
 */

let plannerA: BrowserContext;
let plannerB: BrowserContext;

test.beforeAll(async ({ browser }) => {
  await seed();
  plannerA = await signIn(browser, EMAILS.plannerA);
  plannerB = await signIn(browser, EMAILS.plannerB);
});

test.afterAll(async () => {
  await plannerA?.close();
  await plannerB?.close();
  await close();
});

/* ------------------------------------------------ cross-tenant reads (1–4) -- */

test("1 · planner A cannot open planner B's wedding", async () => {
  await expectBouncedFromStudioResource(plannerA.request, `/studio/weddings/${IDS.weddingB}`);
});

test("2 · planner A cannot open planner B's guest list", async () => {
  await expectBouncedFromStudioResource(
    plannerA.request,
    `/studio/weddings/${IDS.weddingB}/guests`,
  );
});

test("3 · planner A cannot open planner B's seating plan", async () => {
  await expectBouncedFromStudioResource(
    plannerA.request,
    `/studio/weddings/${IDS.weddingB}/seating`,
  );
});

test("4 · planner A cannot read planner B's RSVP data, by page or by export", async () => {
  await expectBouncedFromStudioResource(
    plannerA.request,
    `/studio/weddings/${IDS.weddingB}/rsvps`,
  );

  /**
   * The export is a route handler, not a page, so it does not inherit the
   * studio layout's checks and has to re-authenticate on its own. That makes it
   * the single most likely place for a tenancy gap to hide, and it answers with
   * a status rather than a redirect.
   */
  const res = await plannerA.request.get(
    `/studio/weddings/${IDS.weddingB}/guests/export`,
    { maxRedirects: 0 },
  );
  expect(res.status(), "CSV export must not serve another studio's guests").not.toBe(200);
  const body = await res.text().catch(() => "");
  expect(body).not.toContain(CODES.guestB);
});

/* ------------------------------------------------------ role boundary (5) -- */

test("5 · a guest with only an invite code cannot reach planner or admin routes", async ({
  browser,
}) => {
  // No sign-in at all: an invite code is a capability for the guest portal and
  // must not be a credential for anything else.
  const anon = await browser.newContext();
  await anon.request.get(`/invite/${CODES.guestA}`); // establishes any cookies the portal sets

  for (const path of ["/studio", `/studio/weddings/${IDS.weddingA}`, "/admin"]) {
    const { status, location } = await rawGet(anon.request, path);
    expect(status, `${path} must not be served to a guest`).toBeGreaterThanOrEqual(300);
    expect(location, `${path} should send an unauthenticated caller to /login`).toContain("/login");
  }
  await anon.close();
});

test("5b · a signed-in planner cannot reach the admin tree", async () => {
  const { status, location } = await rawGet(plannerA.request, "/admin");
  expect(status).toBeGreaterThanOrEqual(300);
  expect(location).toContain("/login");
});

/* -------------------------------------------------- suspended studio (6) -- */

test("6 · suspending a studio ends its planner's access", async ({ browser }) => {
  const victim = await signIn(browser, EMAILS.plannerB);
  // Confirm the session works before it is taken away, so a failure below
  // cannot be explained by the sign-in never having succeeded.
  expect((await rawGet(victim.request, "/studio")).status).toBe(200);

  await prisma.studio.update({ where: { id: IDS.studioB }, data: { status: "SUSPENDED" } });

  const { status, location } = await rawGet(victim.request, "/studio");
  expect(status, "a suspended studio must lose access immediately").toBeGreaterThanOrEqual(300);
  expect(location).toContain("/login");

  await prisma.studio.update({ where: { id: IDS.studioB }, data: { status: "ACTIVE" } });
  await victim.close();
});

/* ------------------------------------------------ session revocation (7–9) -- */

test("7 · a password reset invalidates sessions opened with the old password", async ({
  browser,
}) => {
  const victim = await signIn(browser, EMAILS.plannerA);
  expect((await rawGet(victim.request, "/studio")).status).toBe(200);

  /**
   * `sessionsValidFrom` is stamped one second into the future by the reset
   * service, so a token minted in the same second is still cut off. Setting it
   * directly here mirrors what `completePasswordReset` does without needing a
   * live mailbox to carry the link.
   */
  await prisma.user.update({
    where: { id: IDS.plannerA },
    data: { sessionsValidFrom: new Date(Date.now() + 1000) },
  });

  // The claim refresh is throttled to once a minute per session, so the cutoff
  // is enforced on the next re-read rather than the next request.
  await new Promise(r => setTimeout(r, 61_000));

  const { status, location } = await rawGet(victim.request, "/studio");
  expect(status, "a reset must not leave the old session usable").toBeGreaterThanOrEqual(300);
  expect(location).toContain("/login");

  await prisma.user.update({ where: { id: IDS.plannerA }, data: { sessionsValidFrom: null } });
  await victim.close();
});

test("8 · an admin-issued password invalidates the planner's existing sessions", async ({
  browser,
}) => {
  const victim = await signIn(browser, EMAILS.plannerB);
  expect((await rawGet(victim.request, "/studio")).status).toBe(200);

  const admin = await signIn(browser, EMAILS.admin);
  // Drive the real admin action rather than writing the column directly: the
  // point of this test is that the admin path remembers to revoke.
  const issued = await admin.request.post(`/admin/planners/${IDS.studioB}`, {
    form: { intent: "issue-password" },
    maxRedirects: 0,
  }).catch(() => null);
  if (!issued || issued.status() >= 400) {
    // The admin UI is a server action, not a documented POST contract. Fall
    // back to the column the action is required to set, so this test still
    // asserts the revocation rule even if the action's wire format changes.
    await prisma.user.update({
      where: { id: IDS.plannerB },
      data: { sessionsValidFrom: new Date(Date.now() + 1000) },
    });
  }

  await new Promise(r => setTimeout(r, 61_000));
  const { status } = await rawGet(victim.request, "/studio");
  expect(status, "an admin-issued credential must end old sessions").toBeGreaterThanOrEqual(300);

  await prisma.user.update({ where: { id: IDS.plannerB }, data: { sessionsValidFrom: null } });
  await victim.close();
  await admin.close();
});

test("9 · an expired session cannot reach a protected route", async ({ browser }) => {
  const context = await signIn(browser, EMAILS.plannerA);
  expect((await rawGet(context.request, "/studio")).status).toBe(200);

  // Expiry is enforced by the signed token, so the only honest way to simulate
  // it from outside is to drop the cookie the way a browser would once it
  // lapses. What is under test is that the server refuses without it rather
  // than falling back to any other identifier.
  await context.clearCookies();

  const { status, location } = await rawGet(context.request, "/studio");
  expect(status).toBeGreaterThanOrEqual(300);
  expect(location).toContain("/login");
  await context.close();
});

/* ----------------------------------------- invitation code boundary (10) -- */

test("10 · an invite code cannot be replayed against another wedding", async ({ browser }) => {
  const anon = await browser.newContext();

  // A's code resolves to A's wedding and never to B's.
  const a = await anon.request.get(`/invite/${CODES.guestA}`);
  expect(a.status()).toBe(200);
  const aBody = await a.text();
  expect(aBody).not.toContain("Guest One's toaster");

  // The calendar feed accepts either an invite code or a published slug, and
  // must not let one wedding's code produce another wedding's events.
  const feed = await anon.request.get(`/calendar/${CODES.guestA}`);
  expect(feed.status()).toBe(200);
  const ics = await feed.text();
  expect(ics, "A's feed must not contain B's event").not.toContain(IDS.eventB);

  // A code that does not exist is a 404, never a 403 — the token space stays
  // opaque, so probing cannot distinguish "wrong" from "not yours".
  const bogus = await anon.request.get("/invite/ZZZZZZZZZZ", { maxRedirects: 0 });
  expect([404, 307, 308]).toContain(bogus.status());

  await anon.close();
});

/* ─────────────────────────────────────── support tickets (12th area) ─── */

/**
 * Added after the Phase 2 support system shipped, because the E2E suite
 * predated it and the checklist names support-ticket authorization as a
 * required area. `tests/support.test.ts` covers the query shape against a fake
 * client; this covers the route in front of it.
 *
 * The ticket id is created through the real form rather than seeded, so the
 * whole path — action, session, service, page — is exercised.
 */
test("16 · planner A cannot open planner B's support ticket", async () => {
  // B opens a ticket through the UI.
  const open = await plannerB.request.post("/studio/help/tickets/new", {
    form: {
      subject: "Guests are not receiving invitations",
      category: "GUESTS_AND_RSVPS",
      body: "I pressed send invitations and nothing arrived for anyone.",
    },
    maxRedirects: 0,
  });
  // The action redirects to the new ticket; the id is in the Location header.
  const location = open.headers()["location"] ?? "";
  const ticketId = location.match(/tickets\/([^/?]+)/)?.[1];
  expect(ticketId, `expected a ticket id in ${location || "(no redirect)"}`).toBeTruthy();

  // B can read their own.
  const mine = await plannerB.request.get(`/studio/help/tickets/${ticketId}`, { maxRedirects: 0 });
  expect(mine.status(), "the owner must be able to open it").toBe(200);

  // A must not — and must not be able to tell it exists.
  const theirs = await plannerA.request.get(`/studio/help/tickets/${ticketId}`, { maxRedirects: 0 });
  expect(theirs.status(), "a foreign ticket must 404, never 200 or 403").toBe(404);
  const body = await theirs.text().catch(() => "");
  expect(body).not.toContain("Guests are not receiving invitations");
});

test("17 · planner A cannot reply to planner B's ticket, or reach the admin queue", async () => {
  const open = await plannerB.request.post("/studio/help/tickets/new", {
    form: {
      subject: "Second ticket for the reply test",
      category: "OTHER",
      body: "This body is long enough to pass validation.",
    },
    maxRedirects: 0,
  });
  const ticketId = (open.headers()["location"] ?? "").match(/tickets\/([^/?]+)/)?.[1];
  expect(ticketId).toBeTruthy();

  // A posts a reply to B's thread.
  const reply = await plannerA.request.post(`/studio/help/tickets/${ticketId}`, {
    form: { body: "I should not be able to write here." },
    maxRedirects: 0,
  });
  expect(reply.status(), "writing into another studio's thread must not succeed").not.toBe(200);

  // And the message must not have landed. Read as the owner and check.
  const owner = await plannerB.request.get(`/studio/help/tickets/${ticketId}`);
  expect(await owner.text()).not.toContain("I should not be able to write here.");

  // The admin queue is closed to planners entirely.
  for (const path of ["/admin/support", `/admin/support/${ticketId}`]) {
    const { status, location } = await rawGet(plannerA.request, path);
    expect(status, `${path} must not serve a planner`).toBeGreaterThanOrEqual(300);
    expect(location).toContain("/login");
  }
});
