import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The Terms and Privacy gate.
 *
 * The claim being defended: a planner has no access to their account until they
 * have affirmatively agreed to the documents currently in force. Not "has
 * agreed to something at some point" — to *these* versions, both of them.
 *
 * A fake Prisma client, for the same reason as `tenancy.test.ts`: what matters
 * is the query the service builds. A real database with one acceptance row in
 * it would let a query that forgot the version filter pass by accident, which
 * is precisely the bug that would silently disable re-acceptance forever.
 */

const db = {
  legalAcceptance: { findMany: vi.fn(), createMany: vi.fn() },
  studio: { findUnique: vi.fn() },
};

const logAudit = vi.fn(async (_o: { action: string; actorId?: string }) => {});
const authMock = vi.fn();
const redirect = vi.fn((to: string) => { throw new Error(`REDIRECT:${to}`); });

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("server-only", () => ({}));
vi.mock("@/server/services/audit", () => ({
  logAudit: (o: { action: string; actorId?: string }) => logAudit(o) as unknown,
}));
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));

// The versions under test. Imported rather than hard-coded so bumping the real
// constants cannot silently make these tests assert nothing.
const { TERMS_VERSION, PRIVACY_VERSION } = await import("@/lib/legal");

const accepted = (doc: "TERMS" | "PRIVACY") => ({ document: doc });

beforeEach(() => {
  vi.clearAllMocks();
  db.legalAcceptance.createMany.mockResolvedValue({ count: 2 });
  db.studio.findUnique.mockResolvedValue({ id: "studio-a", status: "ACTIVE" });
  authMock.mockResolvedValue({
    user: { id: "user-1", name: "Planner A", email: "a@e.invalid", role: "PLANNER", studioId: "studio-a" },
  });
});

/* ═══════════════════════════════════════════ has the planner agreed ═══ */

describe("hasAcceptedCurrentLegal", () => {
  it("is false on first login — nothing has been accepted", async () => {
    db.legalAcceptance.findMany.mockResolvedValue([]);
    const { hasAcceptedCurrentLegal } = await import("@/server/services/legal");

    expect(await hasAcceptedCurrentLegal("user-1")).toBe(false);
  });

  it("is true when both current versions are on record", async () => {
    db.legalAcceptance.findMany.mockResolvedValue([accepted("TERMS"), accepted("PRIVACY")]);
    const { hasAcceptedCurrentLegal } = await import("@/server/services/legal");

    expect(await hasAcceptedCurrentLegal("user-1")).toBe(true);
  });

  it("is false when only one of the two is accepted", async () => {
    db.legalAcceptance.findMany.mockResolvedValue([accepted("TERMS")]);
    const { hasAcceptedCurrentLegal } = await import("@/server/services/legal");

    // The documents version independently, so agreeing to one says nothing
    // about the other.
    expect(await hasAcceptedCurrentLegal("user-1")).toBe(false);
  });

  it("asks only for the versions currently in force", async () => {
    db.legalAcceptance.findMany.mockResolvedValue([]);
    const { hasAcceptedCurrentLegal } = await import("@/server/services/legal");
    await hasAcceptedCurrentLegal("user-1");

    const where = db.legalAcceptance.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe("user-1");
    expect(where.OR).toEqual([
      { document: "TERMS", version: TERMS_VERSION },
      { document: "PRIVACY", version: PRIVACY_VERSION },
    ]);
  });

  it("treats a row for an older version as not accepted", async () => {
    /**
     * The re-acceptance mechanism in one test. A stale row does not match the
     * `version` filter, so the query returns nothing and the gate closes —
     * which is what makes bumping a constant in `src/lib/legal.ts` sufficient,
     * with no migration and no backfill.
     */
    db.legalAcceptance.findMany.mockResolvedValue([]);   // the 2025 row does not match
    const { hasAcceptedCurrentLegal } = await import("@/server/services/legal");

    expect(await hasAcceptedCurrentLegal("user-1")).toBe(false);
    const where = db.legalAcceptance.findMany.mock.calls[0][0].where;
    expect(where.OR.every((c: { version: string }) => c.version !== "2025-01-01")).toBe(true);
  });

  it("refuses an empty user id rather than querying with one", async () => {
    const { hasAcceptedCurrentLegal } = await import("@/server/services/legal");
    expect(await hasAcceptedCurrentLegal("")).toBe(false);
    expect(db.legalAcceptance.findMany).not.toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════════════════════ recording it ═══ */

describe("acceptCurrentLegal", () => {
  it("writes one row per document at the current versions", async () => {
    const { acceptCurrentLegal } = await import("@/server/services/legal");
    await acceptCurrentLegal("user-1", "Planner A");

    const data = db.legalAcceptance.createMany.mock.calls[0][0].data;
    expect(data).toEqual([
      { userId: "user-1", document: "TERMS", version: TERMS_VERSION },
      { userId: "user-1", document: "PRIVACY", version: PRIVACY_VERSION },
    ]);
  });

  it("skips duplicates rather than upserting, so the original timestamp survives", async () => {
    const { acceptCurrentLegal } = await import("@/server/services/legal");
    await acceptCurrentLegal("user-1", "Planner A");

    /**
     * An upsert would move `acceptedAt` forward when the same version is
     * accepted twice, quietly rewriting when the person actually agreed. The
     * date is the whole point of the record.
     */
    expect(db.legalAcceptance.createMany.mock.calls[0][0].skipDuplicates).toBe(true);
  });

  it("takes the versions from the constants, never from a caller", async () => {
    const { acceptCurrentLegal } = await import("@/server/services/legal");
    // Three parameters would let a form post "I agree to v1" against a page
    // showing v2. There are two, and neither is a version.
    expect(acceptCurrentLegal.length).toBe(2);
  });

  it("records an audit entry naming both versions", async () => {
    const { acceptCurrentLegal } = await import("@/server/services/legal");
    await acceptCurrentLegal("user-1", "Planner A");

    const action = logAudit.mock.calls[0][0].action;
    expect(action).toContain(TERMS_VERSION);
    expect(action).toContain(PRIVACY_VERSION);
    expect(logAudit.mock.calls[0][0].actorId).toBe("user-1");
  });

  it("does not log again when nothing new was written", async () => {
    db.legalAcceptance.createMany.mockResolvedValue({ count: 0 });
    const { acceptCurrentLegal } = await import("@/server/services/legal");
    await acceptCurrentLegal("user-1", "Planner A");

    // A refresh of an already-accepted screen must not fill the audit log with
    // repeated agreements.
    expect(logAudit).not.toHaveBeenCalled();
  });

  it("refuses an empty user id", async () => {
    const { acceptCurrentLegal } = await import("@/server/services/legal");
    await expect(acceptCurrentLegal("", "x")).rejects.toThrow(/userId is required/);
  });
});

/* ═══════════════════════════════════════ what is still outstanding ═══ */

describe("outstandingLegal", () => {
  it("reports both when nothing is accepted", async () => {
    db.legalAcceptance.findMany.mockResolvedValue([]);
    const { outstandingLegal } = await import("@/server/services/legal");
    expect(await outstandingLegal("user-1")).toEqual({ terms: true, privacy: true });
  });

  it("reports only the one that is stale", async () => {
    db.legalAcceptance.findMany.mockResolvedValue([accepted("TERMS")]);
    const { outstandingLegal } = await import("@/server/services/legal");
    expect(await outstandingLegal("user-1")).toEqual({ terms: false, privacy: true });
  });
});

/* ═══════════════════════════════════════════════════ the gate ═══ */

describe("requireStudio — the server-side gate", () => {
  it("redirects an un-accepted planner to /accept-terms", async () => {
    db.legalAcceptance.findMany.mockResolvedValue([]);
    const { requireStudio } = await import("@/server/services/context");

    await expect(requireStudio()).rejects.toThrow("REDIRECT:/accept-terms");
  });

  it("lets an accepted planner through", async () => {
    db.legalAcceptance.findMany.mockResolvedValue([accepted("TERMS"), accepted("PRIVACY")]);
    const { requireStudio } = await import("@/server/services/context");

    const ctx = await requireStudio();
    expect(ctx.studioId).toBe("studio-a");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("re-gates a planner whose accepted version is no longer current", async () => {
    // Their row is for last year's terms, so the version-filtered query finds
    // nothing.
    db.legalAcceptance.findMany.mockResolvedValue([accepted("PRIVACY")]);
    const { requireStudio } = await import("@/server/services/context");

    await expect(requireStudio()).rejects.toThrow("REDIRECT:/accept-terms");
  });

  it("checks the session before the agreement", async () => {
    // A signed-out visitor belongs at /login, not at a consent screen for an
    // account they do not have.
    authMock.mockResolvedValue(null);
    const { requireStudio } = await import("@/server/services/context");

    await expect(requireStudio()).rejects.toThrow("REDIRECT:/login");
    expect(db.legalAcceptance.findMany).not.toHaveBeenCalled();
  });

  it("still refuses a suspended studio, agreement or not", async () => {
    db.legalAcceptance.findMany.mockResolvedValue([accepted("TERMS"), accepted("PRIVACY")]);
    db.studio.findUnique.mockResolvedValue({ id: "studio-a", status: "SUSPENDED" });
    const { requireStudio } = await import("@/server/services/context");

    await expect(requireStudio()).rejects.toThrow("REDIRECT:/login");
  });
});

describe("requireStudioSession — the un-gated door", () => {
  it("does not consult the agreement at all", async () => {
    db.legalAcceptance.findMany.mockResolvedValue([]);
    const { requireStudioSession } = await import("@/server/services/context");

    const ctx = await requireStudioSession();
    expect(ctx.studioId).toBe("studio-a");
    // This is what lets /accept-terms render for someone who has not accepted.
    expect(db.legalAcceptance.findMany).not.toHaveBeenCalled();
  });
});

describe("requireAdmin — unaffected", () => {
  it("lets an admin through without any legal check", async () => {
    authMock.mockResolvedValue({
      user: { id: "admin-1", name: "Owner", email: "o@e.invalid", role: "ADMIN", studioId: null },
    });
    db.legalAcceptance.findMany.mockResolvedValue([]);
    const { requireAdmin } = await import("@/server/services/context");

    const { user } = await requireAdmin();
    expect(user.role).toBe("ADMIN");
    // The agreement is between EventOS and its planners. Staff are not asked.
    expect(db.legalAcceptance.findMany).not.toHaveBeenCalled();
  });
});
