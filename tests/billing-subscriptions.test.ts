import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Subscriptions, the publish flow, and the webhook.
 *
 * The properties under test are the ones that cost real money when they break:
 * a planner cannot name their own price, a wedding cannot be charged for twice,
 * a replayed webhook cannot bill anybody again, and a status change cannot
 * silently reprice a subscription.
 */

const db = {
  wedding: { findFirst: vi.fn(), update: vi.fn() },
  studio: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  payment: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  pricePlan: { findMany: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), updateMany: vi.fn() },
  subscription: { findUnique: vi.fn(), upsert: vi.fn() },
  processedWebhookEvent: { create: vi.fn(), delete: vi.fn() },
  platformSetting: { findUnique: vi.fn(), create: vi.fn() },
  idempotencyKey: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  $transaction: vi.fn(async (arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg) : (arg as (c: unknown) => unknown)(db)),
};

const stripeMock = {
  checkout: { sessions: { create: vi.fn() } },
  customers: { create: vi.fn(), del: vi.fn(), retrieve: vi.fn() },
  prices: { create: vi.fn(), update: vi.fn() },
  billingPortal: { sessions: { create: vi.fn() } },
};

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("server-only", () => ({}));
/**
 * `billingUnavailableInProduction` is part of this module's surface now, and a
 * mock that omits it makes every import of `billing.ts` fail. False here
 * because Stripe *is* enabled in this suite — the fail-closed path is covered
 * on its own in `production-hardening.test.ts`.
 */
vi.mock("@/lib/stripe", () => ({
  stripe: stripeMock,
  stripeEnabled: true,
  isLiveDeployment: () => false,
  billingUnavailableInProduction: () => false,
}));
vi.mock("@/server/services/audit", () => ({ logAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/email", () => ({ emails: { paymentReceipt: vi.fn(async () => true) } }));
/**
 * `billing.ts` reaches `pricing.ts`, which imports the session helpers — and
 * those pull in the whole NextAuth stack at module load. Stubbed so these tests
 * exercise billing rather than authentication, which `pricing.test.ts` covers
 * directly. Nothing under test here calls it: the read path is deliberately not
 * admin-gated, so a planner can see what they pay.
 */
vi.mock("@/server/services/context", () => ({
  requireAdmin: vi.fn(async () => ({ user: { id: "admin-1", name: "Platform Owner" } })),
  requireStudio: vi.fn(),
  ownWedding: vi.fn(),
}));

const PLAN_PER_WEDDING = {
  id: "plan-pw", kind: "PER_WEDDING", amountCents: 9900, currency: "usd",
  studioId: null, activeKey: "PER_WEDDING:GLOBAL", stripePriceId: null,
};
const PLAN_MONTHLY = {
  id: "plan-monthly", kind: "MONTHLY", amountCents: 14900, currency: "usd",
  studioId: null, activeKey: "MONTHLY:GLOBAL", stripePriceId: "price_live_monthly",
};
const WEDDING = { id: "w1", studioId: "studio-a", status: "DRAFT", partnerOne: "Ada", partnerTwo: "Bo" };
const STUDIO = { id: "studio-a", name: "Studio A", contactEmail: "a@example.com", stripeCustomerId: "cus_1", freeWeddingUsed: true };

beforeEach(() => {
  /**
   * Implementations are re-stated here, not just call counts cleared.
   *
   * `vi.clearAllMocks()` forgets who called what but keeps whatever
   * `mockRejectedValue` a previous test installed. The webhook test that makes
   * `upsert` reject leaked into the two tests after it, which then failed
   * inside the error path for a reason that had nothing to do with them —
   * three red tests, one real cause, and the two innocent ones pointing at the
   * wrong line. Every mock that returns something gets its default back on
   * every test.
   *
   * They resolve rather than return undefined for the same reason: real Prisma
   * methods return promises, and a mock that does not turns `.catch()` into a
   * TypeError that looks like an application bug.
   */
  vi.clearAllMocks();
  db.subscription.upsert.mockResolvedValue({});
  db.processedWebhookEvent.delete.mockResolvedValue({});
  db.payment.create.mockResolvedValue({ id: "p-new" });
  db.payment.update.mockResolvedValue({ id: "p-new" });
  db.wedding.update.mockResolvedValue(WEDDING);
  db.studio.update.mockResolvedValue(STUDIO);
  db.idempotencyKey.update.mockResolvedValue({});
  db.idempotencyKey.delete.mockResolvedValue({});
  db.wedding.findFirst.mockResolvedValue(WEDDING);
  db.studio.findUnique.mockResolvedValue(STUDIO);
  db.studio.findUniqueOrThrow.mockResolvedValue(STUDIO);
  db.studio.updateMany.mockResolvedValue({ count: 1 });
  db.platformSetting.findUnique.mockResolvedValue({ id: 1, firstWeddingFree: false, pricePerWeddingCents: 9900 });
  db.pricePlan.findMany.mockResolvedValue([PLAN_PER_WEDDING]);
  db.subscription.findUnique.mockResolvedValue(null);
  db.payment.findUnique.mockResolvedValue(null);
  db.processedWebhookEvent.create.mockResolvedValue({ id: "e1" });
  db.idempotencyKey.create.mockResolvedValue({ key: "k" });
  db.idempotencyKey.findUnique.mockResolvedValue(null);
  stripeMock.checkout.sessions.create.mockResolvedValue({ id: "cs_1", url: "https://checkout.test/1" });
});

/* ═════════════════════════════════════════════════ publish pricing ═══ */

describe("publishing a wedding", () => {
  it("charges the price resolved from the studio, never one supplied by the caller", async () => {
    const { startPublish } = await import("@/server/services/billing");
    const result = await startPublish("studio-a", "w1", "Planner A");

    expect(result.ok).toBe(false);
    const line = stripeMock.checkout.sessions.create.mock.calls[0][0].line_items[0];
    expect(line.price_data.unit_amount, "the amount comes from the PricePlan row").toBe(9900);

    // startPublish takes (studioId, weddingId, actorName) and nothing else —
    // there is no parameter through which an amount could arrive.
    expect(startPublish.length).toBe(3);
  });

  it("uses a studio's custom price when it has one", async () => {
    db.pricePlan.findMany.mockResolvedValue([
      PLAN_PER_WEDDING,
      { ...PLAN_PER_WEDDING, id: "plan-a", amountCents: 7900, studioId: "studio-a", activeKey: "PER_WEDDING:studio-a" },
    ]);
    const { startPublish } = await import("@/server/services/billing");
    await startPublish("studio-a", "w1", "Planner A");

    const line = stripeMock.checkout.sessions.create.mock.calls[0][0].line_items[0];
    expect(line.price_data.unit_amount).toBe(7900);
  });

  it("records which price version produced the charge", async () => {
    const { startPublish } = await import("@/server/services/billing");
    await startPublish("studio-a", "w1", "Planner A");

    const payment = db.payment.create.mock.calls[0][0].data;
    expect(payment.pricePlanId, "the receipt must name the price it was charged on").toBe("plan-pw");
    expect(payment.status).toBe("PENDING");
  });

  it("looks the wedding up scoped to the studio", async () => {
    const { startPublish } = await import("@/server/services/billing");
    await startPublish("studio-a", "w1", "Planner A");

    const where = db.wedding.findFirst.mock.calls[0][0].where;
    expect(where.studioId, "a planner must not be able to publish another studio's wedding").toBe("studio-a");
    expect(where.id).toBe("w1");
  });
});

/* ═══════════════════════════════════════════ duplicate charges ═══ */

describe("a wedding cannot be charged for twice", () => {
  it("claims an idempotency key before creating a Checkout session", async () => {
    const { startPublish } = await import("@/server/services/billing");
    await startPublish("studio-a", "w1", "Planner A");

    expect(db.idempotencyKey.create, "the claim must exist before the charge").toHaveBeenCalled();
    const claim = db.idempotencyKey.create.mock.calls[0][0].data;
    expect(claim.key).toContain("w1");
    expect(claim.studioId).toBe("studio-a");
  });

  it("hands a second press the first session instead of opening another", async () => {
    // P2002 is what Postgres returns when the claim is already held.
    db.idempotencyKey.create.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    db.idempotencyKey.findUnique.mockResolvedValue({
      key: "publish:w1:9900",
      completedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      result: { url: "https://checkout.test/1" },
    });

    const { startPublish } = await import("@/server/services/billing");
    const result = await startPublish("studio-a", "w1", "Planner A");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.checkoutUrl).toBe("https://checkout.test/1");
    expect(
      stripeMock.checkout.sessions.create,
      "a second Checkout session is a second charge waiting to happen",
    ).not.toHaveBeenCalled();
    expect(db.payment.create, "and a second PENDING payment row must not appear").not.toHaveBeenCalled();
  });

  it("does not charge at all for an already published wedding", async () => {
    db.wedding.findFirst.mockResolvedValue({ ...WEDDING, status: "PUBLISHED" });
    const { startPublish } = await import("@/server/services/billing");

    const result = await startPublish("studio-a", "w1", "Planner A");
    expect(result.ok).toBe(true);
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
  });
});

/* ═════════════════════════════════════════ subscription covers ═══ */

describe("a subscriber publishing a wedding", () => {
  beforeEach(() => {
    db.subscription.findUnique.mockResolvedValue({
      studioId: "studio-a", status: "ACTIVE", pricePlanId: "plan-monthly",
      pricePlan: PLAN_MONTHLY,
    });
  });

  it("publishes free, with no Checkout session", async () => {
    const { startPublish } = await import("@/server/services/billing");
    const result = await startPublish("studio-a", "w1", "Planner A");

    expect(result.ok).toBe(true);
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
    const payment = db.payment.create.mock.calls[0][0].data;
    expect(payment.amountCents).toBe(0);
    expect(payment.status).toBe("PAID");
  });

  it("leaves the free wedding unspent", async () => {
    db.platformSetting.findUnique.mockResolvedValue({ id: 1, firstWeddingFree: true, pricePerWeddingCents: 9900 });
    db.studio.findUniqueOrThrow.mockResolvedValue({ ...STUDIO, freeWeddingUsed: false });

    const { startPublish } = await import("@/server/services/billing");
    await startPublish("studio-a", "w1", "Planner A");

    /**
     * The subscription is checked first on purpose. Burning the free wedding on
     * a publish the subscription already covered would leave the studio with
     * nothing to fall back on if they later cancelled — a loss they would only
     * discover much later, with no way to tell where it went.
     */
    expect(db.studio.updateMany, "the free-wedding claim must not run").not.toHaveBeenCalled();
  });

  it("does not count a past-due subscription as covering anything", async () => {
    db.subscription.findUnique.mockResolvedValue({
      studioId: "studio-a", status: "PAST_DUE", pricePlanId: "plan-monthly", pricePlan: PLAN_MONTHLY,
    });
    const { startPublish } = await import("@/server/services/billing");
    await startPublish("studio-a", "w1", "Planner A");

    // Stripe retries a past-due subscription for weeks. Treating that as paid
    // would let a studio publish indefinitely on a card that does not work.
    expect(stripeMock.checkout.sessions.create).toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════════════ starting a plan ═══ */

describe("subscribing", () => {
  beforeEach(() => {
    db.pricePlan.findMany.mockResolvedValue([PLAN_MONTHLY]);
  });

  it("takes a plan kind and resolves the money itself", async () => {
    const { startSubscription } = await import("@/server/services/subscriptions");
    await startSubscription("studio-a", "MONTHLY", "Planner A");

    const args = stripeMock.checkout.sessions.create.mock.calls[0][0];
    expect(args.mode).toBe("subscription");
    // A real Stripe Price id, resolved server-side — not an inline amount and
    // not anything the caller passed in.
    expect(args.line_items[0].price).toBe("price_live_monthly");
    expect(args.line_items[0].price_data, "subscriptions must not use inline prices").toBeUndefined();
  });

  it("stamps the price version onto the subscription for the webhook to read", async () => {
    const { startSubscription } = await import("@/server/services/subscriptions");
    await startSubscription("studio-a", "MONTHLY", "Planner A");

    const args = stripeMock.checkout.sessions.create.mock.calls[0][0];
    expect(args.subscription_data.metadata.pricePlanId).toBe("plan-monthly");
    expect(args.subscription_data.metadata.studioId).toBe("studio-a");
  });

  it("refuses a second subscription for a studio that already has one", async () => {
    db.subscription.findUnique.mockResolvedValue({
      studioId: "studio-a", status: "ACTIVE", pricePlanId: "plan-monthly", pricePlan: PLAN_MONTHLY,
    });
    const { startSubscription } = await import("@/server/services/subscriptions");

    const result = await startSubscription("studio-a", "MONTHLY", "Planner A");
    expect(result.ok).toBe(true);
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("only accepts the two recurring kinds", async () => {
    const { isSubscriptionKind } = await import("@/server/services/subscriptions");
    expect(isSubscriptionKind("MONTHLY")).toBe(true);
    expect(isSubscriptionKind("YEARLY")).toBe(true);
    // PER_WEDDING is not a subscription, and neither is anything typed into a
    // tampered form.
    expect(isSubscriptionKind("PER_WEDDING")).toBe(false);
    expect(isSubscriptionKind("FREE")).toBe(false);
    expect(isSubscriptionKind(undefined)).toBe(false);
  });
});

/* ══════════════════════════════════════════════════ webhook ═══ */

describe("the Stripe webhook", () => {
  const subEvent = (over: Record<string, unknown> = {}) => ({
    id: "evt_1",
    type: "customer.subscription.updated",
    data: {
      object: {
        id: "sub_1",
        customer: "cus_1",
        status: "active",
        cancel_at_period_end: false,
        current_period_end: 1893456000,
        items: { data: [{ price: { id: "price_live_monthly" } }] },
        metadata: { studioId: "studio-a", pricePlanId: "plan-monthly" },
        ...over,
      },
    },
  });

  it("claims the event id before doing any work", async () => {
    const { handleStripeEvent } = await import("@/server/services/stripe-events");
    await handleStripeEvent(subEvent() as never);

    expect(db.processedWebhookEvent.create).toHaveBeenCalled();
    expect(db.processedWebhookEvent.create.mock.calls[0][0].data.stripeEventId).toBe("evt_1");
  });

  it("does nothing at all on a replay", async () => {
    db.processedWebhookEvent.create.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    const { handleStripeEvent } = await import("@/server/services/stripe-events");
    await handleStripeEvent(subEvent() as never);

    // Stripe redelivers on any non-2xx and replays days later. A handler that
    // ran twice would write a second payment row for one real payment.
    expect(db.subscription.upsert).not.toHaveBeenCalled();
  });

  it("releases the claim when a handler throws, so the retry can work", async () => {
    db.subscription.upsert.mockRejectedValue(new Error("db down"));
    const { handleStripeEvent } = await import("@/server/services/stripe-events");

    await expect(handleStripeEvent(subEvent() as never)).rejects.toThrow("db down");
    expect(
      db.processedWebhookEvent.delete,
      "a permanently-claimed event would never be retried and nothing would say why",
    ).toHaveBeenCalled();
  });

  it("never rewrites the price a subscription was sold on", async () => {
    const { handleStripeEvent } = await import("@/server/services/stripe-events");
    await handleStripeEvent(subEvent() as never);

    const upsert = db.subscription.upsert.mock.calls[0][0];
    expect(upsert.create.pricePlanId).toBe("plan-monthly");
    expect(
      "pricePlanId" in upsert.update,
      "a status change is not a repricing — this is what keeps an existing subscription immune to a default change",
    ).toBe(false);
  });

  it("mirrors Stripe's status rather than inventing one", async () => {
    const { handleStripeEvent } = await import("@/server/services/stripe-events");
    await handleStripeEvent(subEvent({ status: "past_due" }) as never);

    expect(db.subscription.upsert.mock.calls[0][0].update.status).toBe("PAST_DUE");
  });

  it("throws on a status it does not recognise instead of guessing", async () => {
    const { toSubscriptionStatus } = await import("@/server/services/subscriptions");
    expect(() => toSubscriptionStatus("some_new_state")).toThrow(/Unrecognised/);
    // Guessing ACTIVE gives the product away; guessing CANCELED cuts off a
    // paying customer. An error reaches the retry queue and a human.
  });

  it("ignores a subscription that names no studio", async () => {
    const { handleStripeEvent } = await import("@/server/services/stripe-events");
    await handleStripeEvent(subEvent({ metadata: {} }) as never);

    // Created outside this application. Picking a studio for it would be
    // inventing a customer relationship.
    expect(db.subscription.upsert).not.toHaveBeenCalled();
  });

  it("records a paid invoice once, keyed on the invoice id", async () => {
    const invoice = {
      id: "evt_2", type: "invoice.paid",
      data: { object: { id: "in_1", customer: "cus_1", amount_paid: 14900, currency: "usd", lines: { data: [{ description: "EventOS monthly" }] } } },
    };
    db.studio.findUnique.mockResolvedValue(STUDIO);
    db.subscription.findUnique.mockResolvedValue({ studioId: "studio-a", pricePlanId: "plan-monthly" });

    const { handleStripeEvent } = await import("@/server/services/stripe-events");
    await handleStripeEvent(invoice as never);

    const payment = db.payment.create.mock.calls[0][0].data;
    expect(payment.stripeInvoiceId).toBe("in_1");
    expect(payment.amountCents).toBe(14900);
    expect(payment.status).toBe("PAID");
  });

  it("does not double-record an invoice it has already seen", async () => {
    db.payment.findUnique.mockResolvedValue({ id: "p1", status: "PAID" });
    const invoice = {
      id: "evt_3", type: "invoice.paid",
      data: { object: { id: "in_1", customer: "cus_1", amount_paid: 14900, currency: "usd", lines: { data: [] } } },
    };
    const { handleStripeEvent } = await import("@/server/services/stripe-events");
    await handleStripeEvent(invoice as never);

    expect(db.payment.create).not.toHaveBeenCalled();
  });

  it("ignores event types it does not handle", async () => {
    const { handleStripeEvent } = await import("@/server/services/stripe-events");
    await handleStripeEvent({ id: "evt_9", type: "customer.created", data: { object: {} } } as never);

    expect(db.processedWebhookEvent.create).not.toHaveBeenCalled();
    expect(db.payment.create).not.toHaveBeenCalled();
  });
});
