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

export async function reset() {
  assertTestDatabase();
  // Studios cascade to users, weddings, guests, events, registry and seats.
  await prisma.studio.deleteMany({ where: { id: { in: [IDS.studioA, IDS.studioB] } } });
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
    await prisma.event.create({
      data: {
        id: eventId, weddingId, title: "Ceremony", day: "Saturday", time: "4:00 PM",
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
