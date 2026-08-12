import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The two business-logic race conditions found in the audit, and the shape of
 * their fixes.
 *
 * Both were the same bug written twice: read a value, decide from it, then write
 * — with a window in between that a second concurrent request fits through. The
 * fix in both cases was to stop deciding in the application and let the database
 * decide, by putting the value being replaced into the WHERE clause of a
 * conditional update.
 *
 * These use the fake Prisma client from the tenancy suite rather than a real
 * database, for the same reason: what is being asserted is the *query the
 * service builds*. A real database would not reproduce the interleaving reliably
 * enough to fail when the guarantee is removed, which would make the test worse
 * than useless — it would pass on the broken version.
 */

const db = {
  studio: { findUniqueOrThrow: vi.fn(), updateMany: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  wedding: { findFirst: vi.fn(), update: vi.fn() },
  payment: { create: vi.fn() },
  registryItem: { findFirst: vi.fn(), updateMany: vi.fn(), findFirstOrThrow: vi.fn() },
  platformSetting: { findUnique: vi.fn() },
  /**
   * Both added when publishing learned about plans: it now checks for a live
   * subscription before claiming the free wedding, and reads the price from a
   * `PricePlan` row rather than the settings singleton. Neither assertion below
   * changed — the fake client just has to describe the same database the
   * service is now talking to.
   */
  subscription: { findUnique: vi.fn() },
  pricePlan: { findMany: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(async (arg: unknown) =>
    typeof arg === "function" ? (arg as (c: unknown) => unknown)(db) : arg),
};

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/stripe", () => ({ stripe: {}, stripeEnabled: false }));
vi.mock("@/lib/email", () => ({ emails: {}, PLATFORM_INBOX: null }));
vi.mock("@/lib/ratelimit", () => ({ rateLimit: vi.fn(async () => true) }));

beforeEach(() => {
  vi.clearAllMocks();
  db.auditLog.create.mockResolvedValue({});
  db.platformSetting.findUnique.mockResolvedValue({
    id: 1, firstWeddingFree: true, pricePerWeddingCents: 20000,
  });
  // No subscription, so the free-wedding path below is the one under test.
  // A subscriber publishes free without ever reaching it, which is its own
  // case in `billing-subscriptions.test.ts`.
  db.subscription.findUnique.mockResolvedValue(null);
  // The same $200 that used to live on the settings row, now where the service
  // actually reads it from.
  db.pricePlan.findMany.mockResolvedValue([{
    id: "plan-pw", kind: "PER_WEDDING", amountCents: 20000, currency: "usd",
    studioId: null, activeKey: "PER_WEDDING:GLOBAL", stripePriceId: null,
  }]);
});

/* ------------------------------------------------ the free wedding slot --- */

describe("startPublish — the free wedding cannot be claimed twice", () => {
  beforeEach(() => {
    db.wedding.findFirst.mockResolvedValue({
      id: "w1", studioId: "studio-a", status: "DRAFT",
      partnerOne: "Sarah", partnerTwo: "James",
    });
    db.studio.findUniqueOrThrow.mockResolvedValue({ id: "studio-a", freeWeddingUsed: false });
    db.wedding.update.mockResolvedValue({});
    db.payment.create.mockResolvedValue({});
  });

  /**
   * The guarantee. Reading `freeWeddingUsed` and then writing it is what allowed
   * two publishes to both be free; the WHERE clause is what makes the database
   * arbitrate instead.
   */
  it("claims the slot with a conditional update, not a blind write", async () => {
    db.studio.updateMany.mockResolvedValue({ count: 1 });
    const { startPublish } = await import("@/server/services/billing");

    await startPublish("studio-a", "w1", "Planner");

    expect(db.studio.updateMany).toHaveBeenCalledWith({
      where: { id: "studio-a", freeWeddingUsed: false },
      data: { freeWeddingUsed: true },
    });
  });

  it("publishes free when it wins the race", async () => {
    db.studio.updateMany.mockResolvedValue({ count: 1 });
    const { startPublish } = await import("@/server/services/billing");

    const result = await startPublish("studio-a", "w1", "Planner");

    expect(result).toEqual({ ok: true });
    expect(db.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amountCents: 0 }) }),
    );
  });

  /**
   * The case that used to give away a second wedding: the row said `false` when
   * we read it, and another request took the slot before we wrote. `count: 0`
   * is the database reporting exactly that, and the studio must be charged.
   */
  it("falls through to the paid path when it loses the race", async () => {
    db.studio.updateMany.mockResolvedValue({ count: 0 });
    const { startPublish } = await import("@/server/services/billing");

    await startPublish("studio-a", "w1", "Planner");

    // Stripe is disabled in this suite, so the paid path records a dev payment
    // at the real price. What matters is that it is not zero.
    const amounts = db.payment.create.mock.calls.map(
      c => (c[0] as { data: { amountCents: number } }).data.amountCents,
    );
    expect(amounts).not.toContain(0);
    expect(amounts).toContain(20000);
  });
});

/* --------------------------------------------------------- gift claiming -- */

describe("claimGift — two guests cannot both claim one gift", () => {
  beforeEach(() => {
    db.registryItem.findFirst.mockResolvedValue({
      id: "item-1", weddingId: "w1", purchasedBy: null,
    });
    db.registryItem.findFirstOrThrow.mockResolvedValue({ id: "item-1", purchasedBy: "First Guest" });
  });

  it("claims only while the gift is still unclaimed", async () => {
    db.registryItem.updateMany.mockResolvedValue({ count: 1 });
    const { claimGift } = await import("@/server/services/registry");

    await claimGift("w1", "item-1", { name: "First Guest", note: "" });

    expect(db.registryItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "item-1", weddingId: "w1", purchasedBy: null },
      }),
    );
  });

  /**
   * The bug this closes: both guests passed the `purchasedBy` check, and the
   * second overwrote the first. The couple saw one name and received two gifts.
   */
  it("refuses the second claimer rather than overwriting the first", async () => {
    db.registryItem.updateMany.mockResolvedValue({ count: 0 });
    db.registryItem.findFirstOrThrow.mockResolvedValue({ id: "item-1", purchasedBy: "First Guest" });
    const { claimGift } = await import("@/server/services/registry");

    await expect(
      claimGift("w1", "item-1", { name: "Second Guest", note: "" }),
    ).rejects.toThrow(/already marked this one as purchased/);
  });

  /** And the message names whoever actually won, not a generic apology. */
  it("names the real claimer in the message", async () => {
    db.registryItem.updateMany.mockResolvedValue({ count: 0 });
    db.registryItem.findFirst
      .mockResolvedValueOnce({ id: "item-1", weddingId: "w1", purchasedBy: null })
      .mockResolvedValueOnce({ id: "item-1", weddingId: "w1", purchasedBy: "Margaret" });
    const { claimGift } = await import("@/server/services/registry");

    await expect(
      claimGift("w1", "item-1", { name: "Second Guest", note: "" }),
    ).rejects.toThrow(/Margaret/);
  });
});
