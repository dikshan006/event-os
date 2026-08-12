import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * Two studios that must never see each other, and one admin.
 *
 * Everything here is deterministic and namespaced under `e2e-` so a run can
 * clean up after itself without touching real rows. The suite is destructive by
 * design — it suspends studios and invalidates sessions — so it must never be
 * pointed at a database anyone cares about. `reset()` refuses to run against a
 * URL that does not look like a test database, which is a cheap guard against
 * the mistake that only has to be made once.
 */

export const prisma = new PrismaClient();

export const PASSWORD = "correct-horse-battery-staple-e2e";

export const IDS = {
  studioA: "e2e-studio-a",
  studioB: "e2e-studio-b",
  plannerA: "e2e-user-a",
  plannerB: "e2e-user-b",
  admin: "e2e-user-admin",
  /**
   * A studio and planner that exist only to be locked out.
   *
   * Case 14 spends the login throttle deliberately — ten wrong passwords in
   * fifteen minutes — and nothing resets the counter afterwards, because
   * `clearLoginFailures` is unreachable on a successful sign-in (the redirect
   * throws first). Pointed at planner A, that took planner A out for the rest
   * of the window and collapsed every later test that had to sign in as them:
   * case 15 immediately after, then the whole of authorization.spec.
   *
   * So the throttle gets its own account, in its own studio, referenced by
   * exactly one test. It owns no wedding, no guest and no ticket, so there is
   * nothing for another test to read, list or collide with.
   */
  studioThrottle: "e2e-studio-throttle",
  throttle: "e2e-user-throttle",
  weddingA: "e2e-wedding-a",
  weddingB: "e2e-wedding-b",
  guestA: "e2e-guest-a",
  guestB: "e2e-guest-b",
  giftB: "e2e-gift-b",
  eventA: "e2e-event-a",
  eventB: "e2e-event-b",
} as const;

export const EMAILS = {
  plannerA: "planner-a@e2e.invalid",
  plannerB: "planner-b@e2e.invalid",
  admin: "admin@e2e.invalid",
  /** Case 14 only. Must never be used to sign in successfully anywhere else. */
  throttle: "throttle@e2e.invalid",
} as const;

/** Invite codes are the guest credential; fixed here so tests can address them. */
export const CODES = {
  guestA: "E2EAAAAAA2",
  guestB: "E2EBBBBBB3",
} as const;

function assertTestDatabase() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/test|e2e|localhost|127\.0\.0\.1/i.test(url)) {
    throw new Error(
      "Refusing to seed: DATABASE_URL does not look like a test database. " +
        "These tests suspend studios and delete rows. Point E2E at a scratch database.",
    );
  }
}

/** Every studio this suite owns. Used by the cleanup below and by nothing else. */
const OUR_STUDIOS = [IDS.studioA, IDS.studioB, IDS.studioThrottle];

export async function reset() {
  assertTestDatabase();

  /**
   * Three tables carry `studioId` with **no foreign key**, so deleting a studio
   * does not take them with it and they survive into the next run.
   *
   * That is not a modelling mistake — a log of what was emailed, what was done
   * and which side effects already ran is meant to outlive the record it refers
   * to. It is, however, invisible contamination for a test that counts rows:
   * case 13 asserts the resend limiter let exactly three invitations through,
   * and on the second run it counted six, because run one's three were still
   * there. The limiter was correct both times.
   *
   * Cleared explicitly, scoped to this suite's studios. Nothing else is touched.
   */
  await prisma.emailLog.deleteMany({ where: { studioId: { in: OUR_STUDIOS } } });
  await prisma.auditLog.deleteMany({ where: { studioId: { in: OUR_STUDIOS } } });
  await prisma.idempotencyKey.deleteMany({ where: { studioId: { in: OUR_STUDIOS } } });

  // Studios cascade to users, weddings, guests, events, registry and seats.
  await prisma.studio.deleteMany({ where: { id: { in: OUR_STUDIOS } } });
  await prisma.user.deleteMany({ where: { email: { in: Object.values(EMAILS) } } });
}

export async function seed() {
  await reset();
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  for (const [studioId, userId, email, slug] of [
    [IDS.studioA, IDS.plannerA, EMAILS.plannerA, "e2e-a"],
    [IDS.studioB, IDS.plannerB, EMAILS.plannerB, "e2e-b"],
  ] as const) {
    await prisma.studio.create({
      data: { id: studioId, name: `E2E ${slug}`, slug, status: "ACTIVE" },
    });
    await prisma.user.create({
      data: { id: userId, email, name: `Planner ${slug}`, passwordHash, role: "PLANNER", studioId },
    });
  }

  await prisma.user.create({
    data: {
      id: IDS.admin, email: EMAILS.admin, name: "E2E Admin",
      passwordHash, role: "ADMIN", studioId: null,
    },
  });

  /**
   * The throttle account.
   *
   * A real, sign-in-able planner rather than an address that does not exist,
   * because the property under test is that the limiter protects a *real*
   * account from being guessed at — and `authorize()` takes a different path
   * for a missing user (it compares against a dummy hash to equalise timing).
   * Case 14 only ever submits wrong passwords, so this never holds a session.
   *
   * Its own studio, containing nothing. Deliberately no wedding, guest, event
   * or ticket: an account that owns no data cannot appear in another test's
   * list, export or admin queue, which is what keeps the lockout contained.
   */
  await prisma.studio.create({
    data: { id: IDS.studioThrottle, name: "E2E throttle", slug: "e2e-throttle", status: "ACTIVE" },
  });
  await prisma.user.create({
    data: {
      id: IDS.throttle, email: EMAILS.throttle, name: "Throttle Target",
      passwordHash, role: "PLANNER", studioId: IDS.studioThrottle,
    },
  });

  for (const [weddingId, studioId, guestId, code, slug, giftId, eventId] of [
    [IDS.weddingA, IDS.studioA, IDS.guestA, CODES.guestA, "e2e-wedding-a", null, IDS.eventA],
    [IDS.weddingB, IDS.studioB, IDS.guestB, CODES.guestB, "e2e-wedding-b", IDS.giftB, IDS.eventB],
  ] as const) {
    await prisma.wedding.create({
      data: {
        id: weddingId, studioId, slug, template: "MODERN_SAGE", status: "PUBLISHED",
        partnerOne: "Ada", partnerTwo: "Grace",
        date: new Date("2027-06-12T16:00:00Z"), timeZone: "UTC",
      },
    });
    /**
     * `startsAt` is not decoration here.
     *
     * The .ics route filters through `calendarable()`, which keeps only events
     * that carry a real instant — an event with just the display strings
     * ("Late", "After the ceremony") cannot go in a calendar. Seeded without
     * one, the feed selected nothing and answered 404, so case 10's calendar
     * assertion could never have run.
     */
    await prisma.event.create({
      data: {
        id: eventId, weddingId, title: "Ceremony", day: "Saturday", time: "4:00 PM",
        startsAt: new Date("2027-06-12T15:00:00Z"),
        endsAt: new Date("2027-06-12T16:00:00Z"),
        sortKey: 10, isPublic: true, audiences: [],
      },
    });
    await prisma.guest.create({
      data: {
        id: guestId, weddingId, studioId, name: "Guest One",
        email: `${guestId}@e2e.invalid`, inviteCode: code, groups: ["Family"],
      },
    });
    if (giftId) {
      await prisma.registryItem.create({
        data: { id: giftId, weddingId, title: "Toaster", url: "https://example.invalid/toaster" },
      });
    }
  }
}

export async function close() {
  await prisma.$disconnect();
}
