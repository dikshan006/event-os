import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { StorageDriver } from "@/lib/storage";

/**
 * The three launch blockers, and the two cleanups behind them.
 *
 * Each one is a case where the failure is silent rather than loud, which is
 * what makes them worth a test rather than a careful reading:
 *
 *   B1 — publishing without Stripe gave the product away *and* wrote a PAID
 *        row saying it had been paid for, destroying the evidence.
 *   B2 — deleting an account left the uploaded photographs public forever and
 *        kept guest email addresses in EmailLog.
 *   C1 — the login lockout counter was never cleared on success.
 */

const db = {
  wedding: { findFirst: vi.fn(), update: vi.fn() },
  studio: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn() },
  payment: { create: vi.fn(), findUnique: vi.fn() },
  pricePlan: { findMany: vi.fn() },
  subscription: { findUnique: vi.fn() },
  platformSetting: { findUnique: vi.fn(), create: vi.fn() },
  emailLog: { deleteMany: vi.fn() },
  auditLog: { deleteMany: vi.fn(), create: vi.fn() },
  idempotencyKey: { deleteMany: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  $transaction: vi.fn(async (arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg) : (arg as (c: unknown) => unknown)(db)),
};

/**
 * Typed from the real driver rather than as a bare `vi.fn()`.
 *
 * `vi.fn(async () => {})` declares no parameters, so `mock.calls` is an array
 * of empty tuples and `calls[0][0]` is a compile error — the assertion about
 * the trailing slash could not even be expressed. Declaring `(_prefix: string)`
 * would fix the error but invent a signature that nothing keeps in step with
 * `StorageDriver`.
 *
 * Borrowing the interface's own type means the mock cannot drift from the
 * thing it stands in for: change `deletePrefix` in `src/lib/storage.ts` and
 * this stops compiling, which is the point of a typed mock. The import is
 * type-only, so it is erased before `vi.mock` replaces the module at runtime.
 */
const deletePrefix = vi.fn<StorageDriver["deletePrefix"]>(async () => {});

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/email", () => ({ emails: { paymentReceipt: vi.fn(async () => true), plannerInvite: vi.fn(async () => true) } }));
vi.mock("@/lib/storage", () => ({ storage: () => ({ deletePrefix, name: "blob" }) }));
vi.mock("@/server/services/context", () => ({
  requireAdmin: vi.fn(async () => ({ user: { id: "a", name: "Platform Owner" } })),
  requireStudio: vi.fn(),
  ownWedding: vi.fn(),
}));

// Arguments pass through, because what the audit entry *says* is the thing
// under test in the deletion cases — not merely that one was written.
const logAudit = vi.fn(async (_o: { action: string; studioId?: string }) => {});
vi.mock("@/server/services/audit", () => ({
  logAudit: (o: { action: string; studioId?: string }) => logAudit(o) as unknown,
}));

const PLAN = {
  id: "plan-pw", kind: "PER_WEDDING", amountCents: 9900, currency: "usd",
  studioId: null, activeKey: "PER_WEDDING:GLOBAL", stripePriceId: null,
};
const WEDDING = { id: "w1", studioId: "studio-a", status: "DRAFT", partnerOne: "Ada", partnerTwo: "Bo" };
const STUDIO = { id: "studio-a", name: "Studio A", contactEmail: "a@example.com", freeWeddingUsed: true, stripeCustomerId: null };

const ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  db.wedding.findFirst.mockResolvedValue(WEDDING);
  db.wedding.update.mockResolvedValue(WEDDING);
  db.studio.findUnique.mockResolvedValue(STUDIO);
  db.studio.findUniqueOrThrow.mockResolvedValue(STUDIO);
  db.studio.update.mockResolvedValue(STUDIO);
  db.studio.delete.mockResolvedValue(STUDIO);
  db.studio.updateMany.mockResolvedValue({ count: 0 });
  db.payment.create.mockResolvedValue({ id: "p1" });
  db.pricePlan.findMany.mockResolvedValue([PLAN]);
  db.subscription.findUnique.mockResolvedValue(null);
  db.platformSetting.findUnique.mockResolvedValue({ id: 1, firstWeddingFree: false, pricePerWeddingCents: 9900 });
  db.emailLog.deleteMany.mockResolvedValue({ count: 3 });
  db.auditLog.deleteMany.mockResolvedValue({ count: 5 });
  db.idempotencyKey.deleteMany.mockResolvedValue({ count: 1 });
  deletePrefix.mockResolvedValue(undefined);
});

afterEach(() => {
  process.env = { ...ENV };
});

/* ════════════════════════════════ B1 — billing must fail closed ═══ */

describe("B1 · publishing when Stripe is not configured", () => {
  /** No STRIPE_SECRET_KEY, and the environment under test. */
  async function loadBilling(vercelEnv: string | undefined, nodeEnv = "production") {
    delete process.env.STRIPE_SECRET_KEY;
    if (vercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = vercelEnv;
    vi.stubEnv("NODE_ENV", nodeEnv);
    return import("@/server/services/billing");
  }

  it("refuses in live production — nothing is published and no payment is written", async () => {
    const { startPublish } = await loadBilling("production");

    await expect(startPublish("studio-a", "w1", "Planner A")).rejects.toThrow(
      /Publishing is temporarily unavailable/,
    );

    /**
     * The two assertions that matter. Publishing anyway would give the product
     * away; writing the PAID row would then hide that it happened, because the
     * billing history would look exactly like a normal sale.
     */
    expect(db.wedding.update, "no wedding may go live").not.toHaveBeenCalled();
    expect(db.payment.create, "no payment record may be invented").not.toHaveBeenCalled();
  });

  it("says so in terms a planner can act on, without naming internals", async () => {
    const { startPublish } = await loadBilling("production");
    const err = await startPublish("studio-a", "w1", "Planner A").catch((e: Error) => e);

    expect(err).toBeInstanceOf(Error);
    const message = (err as Error).message;
    expect(message).toMatch(/draft/i);
    expect(message).toMatch(/support/i);
    // No provider name, no variable name, nothing that reads as a bug report.
    expect(message).not.toMatch(/stripe|env|STRIPE_SECRET_KEY|undefined/i);
  });

  it("keeps the existing dev behaviour on preview", async () => {
    const { startPublish } = await loadBilling("preview");
    const result = await startPublish("studio-a", "w1", "Planner A");

    expect(result.ok).toBe(true);
    expect(db.wedding.update).toHaveBeenCalled();
    expect(db.payment.create).toHaveBeenCalled();
  });

  it("keeps the existing dev behaviour locally", async () => {
    const { startPublish } = await loadBilling(undefined, "development");
    const result = await startPublish("studio-a", "w1", "Planner A");
    expect(result.ok).toBe(true);
  });

  it("treats an absent VERCEL_ENV on a production build as live", async () => {
    /**
     * The fail-closed direction. A variable that goes missing should cost a
     * publish, never a payment — so "unknown environment" resolves to the
     * strict answer rather than the convenient one.
     */
    const { startPublish } = await loadBilling(undefined, "production");
    await expect(startPublish("studio-a", "w1", "Planner A")).rejects.toThrow();
    expect(db.payment.create).not.toHaveBeenCalled();
  });

  it("carries a code so the page can tell it apart from a double-click", async () => {
    const { startPublish } = await loadBilling("production");
    const err = await startPublish("studio-a", "w1", "Planner A").catch((e: unknown) => e);
    expect((err as { code?: string }).code).toBe("BILLING_UNAVAILABLE");
  });

  it("still lets a subscriber publish — they have already paid", async () => {
    db.subscription.findUnique.mockResolvedValue({
      studioId: "studio-a", status: "ACTIVE", pricePlanId: "plan-m",
      pricePlan: { id: "plan-m", kind: "MONTHLY", amountCents: 14900 },
    });
    const { startPublish } = await loadBilling("production");

    const result = await startPublish("studio-a", "w1", "Planner A");
    expect(result.ok, "a paid subscription is unaffected by Stripe being unreachable now").toBe(true);
  });

  /**
   * The launch configuration while charging is paused.
   *
   * The platform per-wedding price is $0 and Stripe is deliberately not
   * configured. Publishing has to work — otherwise every planner publishes
   * their one free wedding and then hits a wall — while the paywall stays
   * closed the moment a real price is set. Both directions are asserted,
   * because a fix for the first that quietly opened the second would be worse
   * than the problem it solved.
   */
  it("publishes a $0 wedding without Stripe — nothing is owed, so nothing needs charging", async () => {
    db.pricePlan.findMany.mockResolvedValue([{ ...PLAN, amountCents: 0 }]);
    const { startPublish } = await loadBilling("production");

    const result = await startPublish("studio-a", "w1", "Planner A");

    expect(result.ok).toBe(true);
    expect(db.wedding.update).toHaveBeenCalled();

    const payment = db.payment.create.mock.calls[0][0].data;
    expect(payment.amountCents).toBe(0);
    expect(payment.status).toBe("PAID");
    // Accurate rather than inherited from the dev-mode wording: no money was
    // due, so the receipt should not imply a missing integration.
    expect(payment.description).toMatch(/no charge/i);
    expect(payment.description).not.toMatch(/dev mode/i);
  });

  it("does not spend the free wedding on a publish that cost nothing", async () => {
    db.platformSetting.findUnique.mockResolvedValue({ id: 1, firstWeddingFree: true, pricePerWeddingCents: 0 });
    db.studio.findUniqueOrThrow.mockResolvedValue({ ...STUDIO, freeWeddingUsed: true });
    db.pricePlan.findMany.mockResolvedValue([{ ...PLAN, amountCents: 0 }]);
    const { startPublish } = await loadBilling("production");

    await startPublish("studio-a", "w1", "Planner A");

    // The free wedding is worth something again the day prices come back, and
    // burning it on a $0 publish would take it away for nothing.
    expect(db.studio.update).not.toHaveBeenCalled();
    expect(db.studio.updateMany).not.toHaveBeenCalled();
  });

  it("still refuses a priced wedding without Stripe — the paywall did not open", async () => {
    db.pricePlan.findMany.mockResolvedValue([{ ...PLAN, amountCents: 9900 }]);
    const { startPublish } = await loadBilling("production");

    await expect(startPublish("studio-a", "w1", "Planner A")).rejects.toThrow(
      /Publishing is temporarily unavailable/,
    );
    expect(db.wedding.update).not.toHaveBeenCalled();
    expect(db.payment.create).not.toHaveBeenCalled();
  });

  it("refuses even one cent — the boundary is zero, not 'small'", async () => {
    db.pricePlan.findMany.mockResolvedValue([{ ...PLAN, amountCents: 1 }]);
    const { startPublish } = await loadBilling("production");

    await expect(startPublish("studio-a", "w1", "Planner A")).rejects.toThrow();
    expect(db.payment.create).not.toHaveBeenCalled();
  });

  it("still honours the free first wedding, which costs nothing to give", async () => {
    db.platformSetting.findUnique.mockResolvedValue({ id: 1, firstWeddingFree: true, pricePerWeddingCents: 9900 });
    db.studio.findUniqueOrThrow.mockResolvedValue({ ...STUDIO, freeWeddingUsed: false });
    db.studio.updateMany.mockResolvedValue({ count: 1 });
    const { startPublish } = await loadBilling("production");

    const result = await startPublish("studio-a", "w1", "Planner A");
    expect(result.ok).toBe(true);
    // Genuinely free, so a zero-amount PAID row is accurate rather than invented.
    expect(db.payment.create.mock.calls[0][0].data.amountCents).toBe(0);
  });
});

/* ══════════════════════════ B2 / C4 — deletion is complete ═══ */

describe("B2 · deleting a planner", () => {
  it("removes the logs that the cascade cannot reach", async () => {
    const { deletePlanner } = await import("@/server/services/admin");
    await deletePlanner("studio-a");

    // No foreign key on these, so the cascade leaves them behind — and
    // EmailLog.toEmail holds guest addresses.
    for (const model of [db.emailLog, db.auditLog, db.idempotencyKey]) {
      expect(model.deleteMany).toHaveBeenCalledWith({ where: { studioId: "studio-a" } });
    }
    expect(db.studio.delete).toHaveBeenCalledWith({ where: { id: "studio-a" } });
  });

  it("deletes the uploaded files, scoped to that studio alone", async () => {
    const { deletePlanner } = await import("@/server/services/admin");
    await deletePlanner("studio-a");

    expect(deletePrefix).toHaveBeenCalledWith("studios/studio-a/");
    /**
     * The trailing slash is the assertion. `studios/studio-a` without it also
     * prefix-matches `studios/studio-abc`, and a deletion that reaches into a
     * second studio's photographs is the worst outcome this function has.
     */
    expect(deletePrefix.mock.calls[0][0]).toMatch(/\/$/);
  });

  it("does the database first, so storage cannot hold an account hostage", async () => {
    const { deletePlanner } = await import("@/server/services/admin");
    await deletePlanner("studio-a");

    const dbOrder = db.$transaction.mock.invocationCallOrder[0];
    const blobOrder = deletePrefix.mock.invocationCallOrder[0];
    expect(dbOrder).toBeLessThan(blobOrder);
  });

  it("completes the deletion even when blob storage fails", async () => {
    deletePrefix.mockRejectedValue(new Error("blob provider down"));
    const { deletePlanner } = await import("@/server/services/admin");

    const result = await deletePlanner("studio-a");

    // A third-party outage must never be the reason somebody cannot delete
    // their own data.
    expect(db.studio.delete).toHaveBeenCalled();
    expect(result?.blobsDeleted).toBe(false);
  });

  it("does not claim the files were removed when they were not", async () => {
    deletePrefix.mockRejectedValue(new Error("blob provider down"));
    const { deletePlanner } = await import("@/server/services/admin");
    await deletePlanner("studio-a");

    /**
     * An audit entry that overstates what happened is worse than none at all:
     * it is the record somebody will later rely on when answering a data
     * deletion request, and "and all of its data" was not true even before
     * storage started failing.
     */
    const action = logAudit.mock.calls.at(-1)?.[0].action ?? "";
    expect(action).toMatch(/could NOT be deleted/);
    expect(action).toContain("studios/studio-a/");
    expect(action, "it must not say the files are gone").not.toMatch(/files removed/);
  });

  it("says both halves are done when both halves are done", async () => {
    const { deletePlanner } = await import("@/server/services/admin");
    await deletePlanner("studio-a");

    const action = logAudit.mock.calls.at(-1)?.[0].action ?? "";
    expect(action).toMatch(/database records and uploaded files removed/);
  });

  it("writes the record of the deletion without a studioId, so it survives the purge", async () => {
    const { deletePlanner } = await import("@/server/services/admin");
    await deletePlanner("studio-a");

    // `auditLog.deleteMany({ where: { studioId } })` runs during this call. An
    // entry tagged with the studio would delete the evidence of its own event.
    expect(logAudit.mock.calls.at(-1)?.[0].studioId).toBeUndefined();
  });

  it("does nothing at all for a studio that is not there", async () => {
    db.studio.findUnique.mockResolvedValue(null);
    const { deletePlanner } = await import("@/server/services/admin");
    await deletePlanner("ghost");

    expect(db.studio.delete).not.toHaveBeenCalled();
    expect(deletePrefix, "a missing studio must not trigger a prefix delete").not.toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════ UserError carries a code ═══ */

describe("UserError", () => {
  it("keeps working without a code, so existing throw sites are untouched", async () => {
    const { UserError } = await import("@/lib/errors");
    const e = new UserError("plain");
    expect(e.message).toBe("plain");
    expect(e.code).toBeUndefined();
    expect(e).toBeInstanceOf(Error);
  });

  it("carries one when given", async () => {
    const { UserError } = await import("@/lib/errors");
    expect(new UserError("x", "SOME_CODE").code).toBe("SOME_CODE");
  });
});

/* ═══════════════════════════ live-deployment predicate ═══ */

describe("isLiveDeployment", () => {
  async function check(vercelEnv: string | undefined, nodeEnv: string) {
    if (vercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = vercelEnv;
    vi.stubEnv("NODE_ENV", nodeEnv);
    vi.resetModules();
    const { isLiveDeployment } = await import("@/lib/stripe");
    return isLiveDeployment();
  }

  it("is true only where real customers are", async () => {
    expect(await check("production", "production")).toBe(true);
    expect(await check("preview", "production")).toBe(false);
    expect(await check("development", "development")).toBe(false);
    expect(await check(undefined, "development")).toBe(false);
    // Fail-closed: unknown environment on a production build counts as live.
    expect(await check(undefined, "production")).toBe(true);
    expect(await check("something-new", "production")).toBe(true);
  });
});
