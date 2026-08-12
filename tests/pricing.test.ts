import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Pricing.
 *
 * Four claims are made to the customer, and each one is a place this could go
 * wrong quietly rather than loudly:
 *
 *   1. a custom studio price overrides the platform default
 *   2. changing the default does not touch an existing subscription
 *   3. a planner cannot choose or influence what they pay
 *   4. no amount, and no Stripe price id, ever arrives from a client
 *
 * A fake Prisma client rather than a database, for the same reason as
 * `tenancy.test.ts`: what is under test is the query the service *builds* and
 * the shape of the write it makes. A real database with one price row in it
 * would let an unscoped lookup pass by accident.
 */

const db = {
  pricePlan: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  studio: { findUniqueOrThrow: vi.fn() },
  $transaction: vi.fn(async (arg: unknown) =>
    Array.isArray(arg)
      ? Promise.all(arg)
      : (arg as (c: unknown) => unknown)(db)),
};

const requireAdmin = vi.fn(async () => ({ user: { id: "admin-1", name: "Platform Owner" } }));

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("server-only", () => ({}));
vi.mock("@/server/services/context", () => ({ requireAdmin: () => requireAdmin() }));
vi.mock("@/server/services/audit", () => ({ logAudit: vi.fn(async () => {}) }));

const GLOBAL_MONTHLY = {
  id: "plan-global-monthly", kind: "MONTHLY", amountCents: 14900,
  currency: "usd", studioId: null, activeKey: "MONTHLY:GLOBAL",
  stripePriceId: null, archivedAt: null,
};
const CUSTOM_MONTHLY = {
  ...GLOBAL_MONTHLY,
  id: "plan-a-monthly", amountCents: 7900,
  studioId: "studio-a", activeKey: "MONTHLY:studio-a",
};

beforeEach(() => {
  vi.clearAllMocks();
  db.pricePlan.create.mockResolvedValue({ ...GLOBAL_MONTHLY, id: "plan-new" });
  db.pricePlan.updateMany.mockResolvedValue({ count: 1 });
  db.studio.findUniqueOrThrow.mockResolvedValue({ id: "studio-a" });
});

/* ══════════════════════════════════════════════════════ resolution ═══ */

describe("what a studio actually pays", () => {
  it("prefers the studio's custom price over the platform default", async () => {
    db.pricePlan.findMany.mockResolvedValue([GLOBAL_MONTHLY, CUSTOM_MONTHLY]);
    const { resolvePrice } = await import("@/server/services/pricing");

    const plan = await resolvePrice("studio-a", "MONTHLY");
    expect(plan.amountCents, "the override must win").toBe(7900);
  });

  it("falls back to the platform default when there is no override", async () => {
    db.pricePlan.findMany.mockResolvedValue([GLOBAL_MONTHLY]);
    const { resolvePrice } = await import("@/server/services/pricing");

    const plan = await resolvePrice("studio-b", "MONTHLY");
    expect(plan.amountCents).toBe(14900);
    expect(plan.studioId, "the default is not owned by any studio").toBeNull();
  });

  it("asks for both scopes in a single query, so the fallback cannot race", async () => {
    db.pricePlan.findMany.mockResolvedValue([GLOBAL_MONTHLY]);
    const { resolvePrice } = await import("@/server/services/pricing");
    await resolvePrice("studio-a", "MONTHLY");

    expect(db.pricePlan.findMany).toHaveBeenCalledTimes(1);
    const where = db.pricePlan.findMany.mock.calls[0][0].where;
    expect(where.activeKey.in).toEqual(["MONTHLY:studio-a", "MONTHLY:GLOBAL"]);
  });

  it("reads only live rows — an archived price has a null activeKey and cannot match", async () => {
    db.pricePlan.findMany.mockResolvedValue([GLOBAL_MONTHLY]);
    const { resolvePrice, activeKeyFor } = await import("@/server/services/pricing");
    await resolvePrice("studio-a", "MONTHLY");

    const where = db.pricePlan.findMany.mock.calls[0][0].where;
    // The lookup is by activeKey and nothing else. Archiving sets that column
    // to NULL, so an archived row is unreachable here by construction rather
    // than by an `archivedAt: null` filter somebody has to remember to add.
    expect(Object.keys(where)).toEqual(["activeKey"]);
    expect(where.activeKey.in).not.toContain(null);
    expect(activeKeyFor("MONTHLY", "studio-a")).toBe("MONTHLY:studio-a");
  });

  it("throws rather than inventing a price when none is configured", async () => {
    db.pricePlan.findMany.mockResolvedValue([]);
    const { resolvePrice } = await import("@/server/services/pricing");

    // Falling back to a hard-coded number here would charge somebody an amount
    // no admin ever chose, and it would look completely normal on the receipt.
    await expect(resolvePrice("studio-a", "MONTHLY")).rejects.toThrow(/No active MONTHLY price/);
  });

  it("refuses to resolve without a studio", async () => {
    const { resolvePrice } = await import("@/server/services/pricing");
    await expect(resolvePrice("", "MONTHLY")).rejects.toThrow(/studioId is required/);
    expect(db.pricePlan.findMany, "no query may be built from an empty tenant").not.toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════════════════ versioning ═══ */

describe("changing a price", () => {
  it("archives the old row and inserts a new one, in one transaction", async () => {
    const { setPrice } = await import("@/server/services/pricing-admin");
    await setPrice({ kind: "MONTHLY", amountCents: 12900 });

    expect(db.$transaction, "both writes must be atomic").toHaveBeenCalledTimes(1);

    const archived = db.pricePlan.updateMany.mock.calls[0][0];
    expect(archived.where.activeKey).toBe("MONTHLY:GLOBAL");
    expect(archived.data.activeKey, "releasing the scope is what frees the unique key").toBeNull();
    expect(archived.data.archivedAt).toBeInstanceOf(Date);

    const created = db.pricePlan.create.mock.calls[0][0].data;
    expect(created.amountCents).toBe(12900);
    expect(created.activeKey).toBe("MONTHLY:GLOBAL");
  });

  it("never updates an existing plan row in place", async () => {
    const { setPrice } = await import("@/server/services/pricing-admin");
    await setPrice({ kind: "MONTHLY", amountCents: 12900 });

    /**
     * This is the whole guarantee behind "changing a default must not change
     * existing subscriptions". A subscription holds `pricePlanId`; as long as
     * nothing rewrites `amountCents` on a row, the price it points at cannot
     * move. The only write to an existing row is the archival above, which
     * touches `activeKey` and `archivedAt` and nothing else.
     */
    for (const call of db.pricePlan.updateMany.mock.calls) {
      expect(
        Object.keys(call[0].data).sort(),
        "archiving must not touch the amount",
      ).toEqual(["activeKey", "archivedAt"]);
    }
  });

  it("writes a studio override under that studio's own key", async () => {
    const { setPrice } = await import("@/server/services/pricing-admin");
    await setPrice({ kind: "PER_WEDDING", amountCents: 7900, studioId: "studio-a" });

    const created = db.pricePlan.create.mock.calls[0][0].data;
    expect(created.studioId).toBe("studio-a");
    expect(created.activeKey).toBe("PER_WEDDING:studio-a");
    // Scoped archival: setting studio A's price must not archive the default
    // that every other studio is resolving against.
    expect(db.pricePlan.updateMany.mock.calls[0][0].where.activeKey).toBe("PER_WEDDING:studio-a");
  });

  it("clears an override by archiving it, never by deleting it", async () => {
    const { clearStudioPrice } = await import("@/server/services/pricing-admin");
    await clearStudioPrice({ studioId: "studio-a", kind: "MONTHLY" });

    const where = db.pricePlan.updateMany.mock.calls[0][0].where;
    // Both halves of the key, so a bug in one cannot archive another studio's
    // override or the platform default.
    expect(where.activeKey).toBe("MONTHLY:studio-a");
    expect(where.studioId).toBe("studio-a");
    expect(db.pricePlan.updateMany.mock.calls[0][0].data.activeKey).toBeNull();
  });

  it("rejects a fat-fingered amount", async () => {
    const { setPrice } = await import("@/server/services/pricing-admin");

    await expect(setPrice({ kind: "MONTHLY", amountCents: 99_999_00 })).rejects.toThrow(/typo/);
    await expect(setPrice({ kind: "MONTHLY", amountCents: -100 })).rejects.toThrow(/not negative/);
    await expect(setPrice({ kind: "MONTHLY", amountCents: 149.5 })).rejects.toThrow(/whole number/);
    expect(db.pricePlan.create, "nothing may be written for a rejected amount").not.toHaveBeenCalled();
  });

  it("allows a genuinely free price", async () => {
    const { setPrice } = await import("@/server/services/pricing-admin");
    await setPrice({ kind: "PER_WEDDING", amountCents: 0 });
    expect(db.pricePlan.create.mock.calls[0][0].data.amountCents).toBe(0);
  });
});

/* ═══════════════════════════════════════════════ authorization ═══ */

describe("who may change a price", () => {
  it("requires an admin session for every mutation", async () => {
    const { setPrice, clearStudioPrice } = await import("@/server/services/pricing-admin");

    await setPrice({ kind: "MONTHLY", amountCents: 100 });
    expect(requireAdmin, "setting a price is admin-only").toHaveBeenCalled();

    requireAdmin.mockClear();
    await clearStudioPrice({ studioId: "studio-a", kind: "MONTHLY" });
    expect(requireAdmin, "clearing a price is admin-only").toHaveBeenCalled();
  });

  it("checks the session before writing anything", async () => {
    // A planner reaching this function must be turned away before the write,
    // not after it. `requireAdmin` redirects, so this asserts ordering.
    requireAdmin.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));
    const { setPrice } = await import("@/server/services/pricing-admin");

    await expect(setPrice({ kind: "MONTHLY", amountCents: 100 })).rejects.toThrow();
    expect(db.pricePlan.create).not.toHaveBeenCalled();
    expect(db.pricePlan.updateMany).not.toHaveBeenCalled();
  });

  it("reading a price needs no admin — planners see what they pay", async () => {
    db.pricePlan.findMany.mockResolvedValue([GLOBAL_MONTHLY]);
    const { resolvePrice } = await import("@/server/services/pricing");

    await resolvePrice("studio-a", "MONTHLY");
    expect(requireAdmin).not.toHaveBeenCalled();
  });
});
