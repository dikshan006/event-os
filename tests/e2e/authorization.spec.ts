import { test, expect, type BrowserContext } from "@playwright/test";
import bcrypt from "bcryptjs";
import { seed, close, prisma, IDS, EMAILS, CODES, PASSWORD } from "./seed";
import { signIn, signInAs, rawGet, expectBouncedFromStudioResource } from "./helpers";

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
  /**
   * Longer than the suite default, because the wait below is a production
   * constant rather than a guess.
   *
   * `auth.ts` re-reads the account only after `CLAIM_REFRESH_MS` (60s), so a
   * revoked session is genuinely still usable until the next re-read — that is
   * the documented design, not a bug. Observing the revocation therefore takes
   * just over a minute, and the suite's 30s cap killed this test mid-wait
   * before it reached a single assertion.
   *
   * Scoped to this test. The global timeout, the 61s wait and
   * `CLAIM_REFRESH_MS` are all unchanged.
   */
  test.setTimeout(120_000);

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
  /**
   * Longer than the suite default, because the wait below is a production
   * constant rather than a guess.
   *
   * `auth.ts` re-reads the account only after `CLAIM_REFRESH_MS` (60s), so a
   * revoked session is genuinely still usable until the next re-read — that is
   * the documented design, not a bug. Observing the revocation therefore takes
   * just over a minute, and the suite's 30s cap killed this test mid-wait
   * before it reached a single assertion.
   *
   * Scoped to this test. The global timeout, the 61s wait and
   * `CLAIM_REFRESH_MS` are all unchanged.
   */
  test.setTimeout(120_000);

  const victim = await signIn(browser, EMAILS.plannerB);
  expect((await rawGet(victim.request, "/studio")).status).toBe(200);

  /**
   * Registered *before* the mutation, so it runs however this test ends.
   *
   * This test issues planner B a genuinely new credential through the real
   * admin dialog — that is the behaviour under test and it is working. What it
   * failed to do was put the fixture back: the seeded password no longer
   * authenticated planner B, and case 16 died at sign-in with `?error=1`
   * before it could evaluate a single ticket-isolation assertion.
   *
   * `sessionsValidFrom` was already restored at the end of the happy path, but
   * an assertion failing partway through skipped even that. A registered
   * cleanup runs on pass, on failure and on timeout alike, which is the only
   * arrangement that leaves the fixture usable for the tests that follow.
   *
   * The password is re-hashed with bcrypt at the same cost the application
   * uses. The plaintext never reaches the database — only a hash of the value
   * `seed.ts` already knows.
   */
  const restorePlannerB = async () => {
    await prisma.user.update({
      where: { id: IDS.plannerB },
      data: { sessionsValidFrom: null, passwordHash: await bcrypt.hash(PASSWORD, 12) },
    });
  };

  /**
   * Driven through the real admin dialog, with no fallback.
   *
   * The previous version POSTed at `/admin/planners` and, when that did not
   * work — which it never could, because issuing a password is a Server Action
   * — wrote `sessionsValidFrom` directly and carried on. That asserted the
   * revocation *rule* while quietly excusing the admin *path* from proving it
   * triggers the rule, which is the only thing this test exists to show.
   *
   * Now: open the planners list, press Password on studio B's row, choose the
   * generated option, submit. If any of that is missing the test fails here.
   */
  const admin = await signInAs(browser, EMAILS.admin);

  try {
    await admin.page.goto("/admin/planners");

    const row = admin.page.locator("tr", { hasText: "E2E e2e-b" }).first();
    await expect(row, "studio B must appear in the planners list").toBeVisible();
    await row.getByRole("button", { name: "Password" }).click();

    const dialog = admin.page.locator("dialog.dlg[open]");
    await expect(dialog, "the password dialog must open").toBeVisible();
    await dialog.getByRole("button", { name: "Generate password" }).click();

    /**
     * The flash confirms the action actually ran: it is rendered from the value
     * `resetPlannerPassword` returned, so it cannot appear unless a password
     * was genuinely issued.
     */
    await expect(
      admin.page.locator("code"),
      "the new credential must be shown once, which proves the action ran",
    ).toBeVisible({ timeout: 15_000 });

    // And the database must record the revocation, not merely the new password.
    const revoked = await prisma.user.findUniqueOrThrow({
      where: { id: IDS.plannerB },
      select: { sessionsValidFrom: true },
    });
    expect(
      revoked.sessionsValidFrom,
      "issuing a password must stamp sessionsValidFrom, or old sessions survive",
    ).toBeInstanceOf(Date);

    // The claim refresh is throttled to once a minute, so the cutoff lands on
    // the next re-read rather than the next request.
    await new Promise(r => setTimeout(r, 61_000));
    const { status, location } = await rawGet(victim.request, "/studio");
    expect(status, "an admin-issued credential must end old sessions").toBeGreaterThanOrEqual(300);
    expect(location).toContain("/login");
  } finally {
    await restorePlannerB();
    await victim.close();
    await admin.context.close();
  }
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

  /**
   * The calendar feed, at its real address.
   *
   * The route is `/calendar/{token}/{event}.ics` — one handler serving both an
   * invite code and a published wedding slug. The earlier `/calendar/{code}`
   * matched no route and 404'd, so this assertion had never once run.
   *
   * Strengthened while correcting it: A's feed must positively contain A's
   * event, not merely lack B's. A 404 body or an empty calendar would satisfy
   * "does not contain B" without proving anything.
   */
  const feed = await anon.request.get(`/calendar/${CODES.guestA}/all.ics`);
  expect(feed.status(), "the personal .ics feed must resolve for a valid code").toBe(200);
  const ics = await feed.text();
  expect(ics, "A's feed must carry A's own event").toContain(`${IDS.eventA}@eventos`);
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
/**
 * Opens a ticket the way a planner does: from the Help Center, through the
 * form, pressing the button. Returns the ticket id from the URL it lands on.
 */
async function openTicketViaUi(
  page: import("@playwright/test").Page,
  subject: string,
  body: string,
) {
  await page.goto("/studio/help/tickets/new");
  await page.fill('input[name="subject"]', subject);
  await page.selectOption('select[name="category"]', "GUESTS_AND_RSVPS");
  await page.fill('textarea[name="body"]', body);
  /**
   * The negative lookahead is load-bearing.
   *
   * `/\/studio\/help\/tickets\/[^/]+/` matches the form's own URL,
   * `/studio/help/tickets/new`. `waitForURL` checks the current location first,
   * so it resolved instantly — before the click had even been processed — and
   * captured the literal string "new" as the ticket id. The database lookup
   * then failed on a record that was never going to exist, while the real
   * submission may not have happened at all.
   */
  await Promise.all([
    page.waitForURL(/\/studio\/help\/tickets\/(?!new(\?|$))[^/?]+/, { timeout: 20_000 }),
    page.getByRole("button", { name: "Send to support" }).click(),
  ]);
  const id = page.url().match(/tickets\/([^/?]+)/)?.[1];
  expect(id, `expected a ticket id in ${page.url()}`).toBeTruthy();
  expect(
    id,
    `landed back on the form at ${page.url()} — the ticket was not created, ` +
      "most likely a validation error on the submitted fields",
  ).not.toBe("new");
  return id as string;
}

test("16 · a planner opens a ticket, and only their studio can read it", async ({ browser }) => {
  const b = await signInAs(browser, EMAILS.plannerB);
  const subject = "Guests are not receiving invitations";
  const ticketId = await openTicketViaUi(
    b.page,
    subject,
    "I pressed send invitations and nothing arrived for anyone.",
  );

  // The ticket really exists, owned by B's studio — not merely a redirect.
  const row = await prisma.supportTicket.findUniqueOrThrow({
    where: { id: ticketId },
    include: { messages: true },
  });
  expect(row.studioId, "ownership comes from the session, not the form").toBe(IDS.studioB);
  expect(row.userId).toBe(IDS.plannerB);
  expect(row.status).toBe("OPEN");
  expect(row.messages, "the opening message is written with the ticket").toHaveLength(1);
  expect(row.messages[0].authorType).toBe("PLANNER");

  // B sees their own thread, with what they typed in it.
  await expect(b.page.getByText(subject)).toBeVisible();
  await b.page.goto("/studio/help/tickets");
  await expect(
    b.page.getByRole("link", { name: /Open ticket/ }).first(),
    "the ticket must be listed with a way to open it",
  ).toBeVisible();

  /**
   * A must not — and must not be able to tell it exists. 404, never 403: a
   * foreign ticket and a missing one have to be indistinguishable, or the
   * response becomes an oracle for which ids are real.
   */
  const theirs = await plannerA.request.get(`/studio/help/tickets/${ticketId}`, {
    maxRedirects: 0,
  });
  expect(theirs.status(), "a foreign ticket must 404, never 200 or 403").toBe(404);
  expect(await theirs.text().catch(() => "")).not.toContain(subject);

  // Nor may it leak into A's own list.
  const a = await signInAs(browser, EMAILS.plannerA);
  await a.page.goto("/studio/help/tickets");
  await expect(
    a.page.getByText(subject),
    "another studio's subject must never appear in this planner's list",
  ).toHaveCount(0);

  await a.context.close();
  await b.context.close();
});

test("17 · a planner replies to their own ticket, and cannot reach anyone else's", async ({
  browser,
}) => {
  const b = await signInAs(browser, EMAILS.plannerB);
  const ticketId = await openTicketViaUi(
    b.page,
    "Second ticket, for the reply test",
    "This body is long enough to pass validation.",
  );

  // Reply through the real form on the thread page.
  const reply = "Adding one more detail: it started on Tuesday.";
  await b.page.fill('textarea[name="body"]', reply);
  await b.page.getByRole("button", { name: /Send reply/ }).click();
  await expect(
    b.page.getByText(reply),
    "the planner's own reply must appear in their thread",
  ).toBeVisible({ timeout: 15_000 });

  const after = await prisma.supportTicket.findUniqueOrThrow({
    where: { id: ticketId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  expect(after.messages, "the reply is appended, not replacing the original").toHaveLength(2);
  expect(after.messages[1].body).toBe(reply);
  expect(after.messages[1].authorType).toBe("PLANNER");

  /**
   * A has no route to B's reply form at all.
   *
   * Stated rather than faked. Replying is a Server Action rendered inside the
   * thread page, and Next verifies an encoded action id server-side — so there
   * is no request a planner can construct from outside that reaches it. The
   * boundary a browser can prove is that the page carrying the form is
   * unreachable, and that is what is asserted. The service-level guard, that
   * `replyAsPlanner` filters on studioId even if called directly, is covered by
   * `tests/support.test.ts`.
   */
  const page404 = await plannerA.request.get(`/studio/help/tickets/${ticketId}`, {
    maxRedirects: 0,
  });
  expect(page404.status(), "no reply form is reachable for a foreign ticket").toBe(404);

  // The message count must be unchanged by A's attempt to reach it.
  const untouched = await prisma.ticketMessage.count({ where: { ticketId } });
  expect(untouched, "nothing may be appended by a planner who cannot open it").toBe(2);

  // And the admin queue is closed to planners entirely.
  for (const path of ["/admin/support", `/admin/support/${ticketId}`]) {
    const { status, location } = await rawGet(plannerA.request, path);
    expect(status, `${path} must not serve a planner`).toBeGreaterThanOrEqual(300);
    expect(location).toContain("/login");
  }

  await b.context.close();
});
