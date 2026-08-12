import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Support ticket authorization.
 *
 * The support system is the newest place in the product where one planner
 * could read another's data, and it has the shape that always precedes that
 * bug: an id in a URL, typed by whoever is holding the browser. These tests
 * assert the rule at the layer that enforces it — every planner-facing query
 * must carry `studioId` in its WHERE clause, and no function may accept a
 * studio id from anything a client controls.
 *
 * A fake Prisma client rather than a database, for the same reason as
 * `tenancy.test.ts`: what is under test is the query the service *builds*. A
 * real database with one studio in it would let an unscoped query pass by
 * accident.
 */

const db = {
  supportTicket: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    groupBy: vi.fn(),
  },
  ticketMessage: { create: vi.fn() },
  $transaction: vi.fn(async (arg: unknown) =>
    typeof arg === "function" ? (arg as (c: unknown) => unknown)(db) : arg),
};

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/email", () => ({
  emails: { supportTicketOpened: vi.fn(async () => true), supportTicketReply: vi.fn(async () => true) },
}));
vi.mock("@/server/services/audit", () => ({ logAudit: vi.fn(async () => {}) }));
// Allowed by default; the throttle has its own test below. Typed rather than
// spread through `unknown[]`, so `mock.calls[0][0]` is a string and the
// assertion about which key the limiter was given actually type-checks.
const rateLimit = vi.fn(async (_key: string, _limit: number, _windowMs: number) => true);
vi.mock("@/lib/ratelimit", () => ({
  rateLimit: (key: string, limit: number, windowMs: number) => rateLimit(key, limit, windowMs),
}));

/** Every `where` object any mocked method was called with. */
function wheres(): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const model of Object.values(db)) {
    if (typeof model !== "object" || model === null) continue;
    for (const fn of Object.values(model)) {
      if (typeof fn !== "function" || !("mock" in fn)) continue;
      for (const call of (fn as ReturnType<typeof vi.fn>).mock.calls) {
        const w = (call?.[0] as { where?: Record<string, unknown> })?.where;
        if (w) out.push(w);
      }
    }
  }
  return out;
}

const TICKET = {
  id: "t1",
  studioId: "studio-a",
  userId: "u1",
  subject: "Guests are not receiving invitations",
  status: "OPEN" as const,
  firstReplyAt: null,
  studio: { name: "Studio A" },
  user: { email: "a@example.com", name: "Planner A" },
};

beforeEach(() => {
  vi.clearAllMocks();
  rateLimit.mockResolvedValue(true);
  db.supportTicket.create.mockResolvedValue(TICKET);
  db.supportTicket.findFirst.mockResolvedValue(TICKET);
  db.supportTicket.findUnique.mockResolvedValue(TICKET);
  db.supportTicket.update.mockResolvedValue(TICKET);
  db.supportTicket.updateMany.mockResolvedValue({ count: 1 });
  db.supportTicket.findMany.mockResolvedValue([]);
});

/* ═════════════════════════════════════════════════ planner: own data ═══ */

describe("a planner and their own tickets", () => {
  it("creates a ticket owned by the session's studio and user", async () => {
    const { createTicket } = await import("@/server/services/support");
    await createTicket("studio-a", "u1", "Planner A", {
      subject: "Guests are not receiving invitations",
      category: "GUESTS_AND_RSVPS",
      body: "I pressed send invitations and nothing arrived.",
    });

    const data = db.supportTicket.create.mock.calls[0][0].data;
    expect(data.studioId).toBe("studio-a");
    expect(data.userId).toBe("u1");
    // The opening message is written in the same statement, so a ticket can
    // never exist with an empty thread.
    expect(data.messages.create.authorType).toBe("PLANNER");
    expect(data.messages.create.body).toContain("nothing arrived");
  });

  it("lists only the caller's studio", async () => {
    const { listMyTickets } = await import("@/server/services/support");
    await listMyTickets("studio-a");

    const w = db.supportTicket.findMany.mock.calls[0][0].where;
    expect(w.studioId).toBe("studio-a");
  });

  it("fetches one ticket by id AND studio, in a single query", async () => {
    const { getMyTicket } = await import("@/server/services/support");
    await getMyTicket("studio-a", "t1");

    const w = db.supportTicket.findFirst.mock.calls[0][0].where;
    expect(w.id).toBe("t1");
    expect(w.studioId, "the tenancy check must be part of the lookup").toBe("studio-a");
  });

  it("can reply to its own ticket, and the write stays scoped", async () => {
    const { replyAsPlanner } = await import("@/server/services/support");
    await replyAsPlanner("studio-a", "t1", "Planner A", "Still not working.");

    expect(db.ticketMessage.create).toHaveBeenCalled();
    const msg = db.ticketMessage.create.mock.calls[0][0].data;
    expect(msg.authorType).toBe("PLANNER");
    expect(msg.ticketId).toBe("t1");

    // The status write carries the tenant too, so it cannot move a foreign row.
    const upd = db.supportTicket.updateMany.mock.calls[0][0].where;
    expect(upd.studioId).toBe("studio-a");
  });

  it("reopens a resolved ticket when the planner replies to it", async () => {
    db.supportTicket.findFirst.mockResolvedValue({ ...TICKET, status: "RESOLVED" });
    const { replyAsPlanner } = await import("@/server/services/support");
    await replyAsPlanner("studio-a", "t1", "Planner A", "This is still happening.");

    const data = db.supportTicket.updateMany.mock.calls[0][0].data;
    expect(data.status, "a reply to a resolved ticket means it was not resolved").toBe("OPEN");
  });
});

/* ══════════════════════════════════════════ planner: someone else's ═══ */

describe("a planner and another planner's ticket", () => {
  it("cannot read it — the scoped lookup simply does not resolve", async () => {
    // Studio B's ticket does not match `{ id, studioId: "studio-a" }`.
    db.supportTicket.findFirst.mockResolvedValue(null);
    const { getMyTicket } = await import("@/server/services/support");

    const found = await getMyTicket("studio-a", "ticket-belonging-to-b");
    expect(found, "a foreign ticket must be indistinguishable from a missing one").toBeNull();
  });

  it("cannot reply to it", async () => {
    db.supportTicket.findFirst.mockResolvedValue(null);
    const { replyAsPlanner } = await import("@/server/services/support");

    await expect(
      replyAsPlanner("studio-a", "ticket-belonging-to-b", "Planner A", "hello"),
    ).rejects.toThrow();
    expect(db.ticketMessage.create, "no message may be written").not.toHaveBeenCalled();
  });

  it("never issues an unscoped query from any planner-facing function", async () => {
    const s = await import("@/server/services/support");
    await s.listMyTickets("studio-a");
    await s.getMyTicket("studio-a", "t1");
    await s.replyAsPlanner("studio-a", "t1", "Planner A", "hi");

    const unscoped = wheres().filter(w => !("studioId" in w) && !("ticketId" in w));
    expect(
      unscoped,
      `every planner-side query must carry studioId; found ${JSON.stringify(unscoped)}`,
    ).toHaveLength(0);
  });
});

/* ═══════════════════════════════════════════ ownership is not an input ═══ */

describe("ticket ownership", () => {
  /**
   * The strongest guarantee available: not that a bad studioId is rejected, but
   * that there is nowhere to put one. A validator can be bypassed by a later
   * refactor; a parameter that does not exist cannot.
   */
  it("is not accepted from the client — the schema has no studio or user field", async () => {
    const { zTicket } = await import("@/lib/validators");
    const parsed = zTicket.parse({
      subject: "Trying to file this into another studio",
      category: "OTHER",
      body: "This body is long enough to pass validation.",
      // Both ignored: zod strips unknown keys by default.
      studioId: "studio-b",
      userId: "someone-else",
    } as never);

    expect(parsed).not.toHaveProperty("studioId");
    expect(parsed).not.toHaveProperty("userId");
  });

  it("cannot be reassigned by a planner reply", async () => {
    const { replyAsPlanner } = await import("@/server/services/support");
    await replyAsPlanner("studio-a", "t1", "Planner A", "hello");

    const data = db.supportTicket.updateMany.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("studioId");
    expect(data).not.toHaveProperty("userId");
  });

  it("cannot be reassigned by an admin reply or a status change", async () => {
    const s = await import("@/server/services/support");
    await s.replyAsAdmin("t1", "Platform Owner", "Have a look at the email log.");
    await s.setTicketStatus("t1", "RESOLVED", "Platform Owner");
    await s.setTicketPriority("t1", "HIGH", "Platform Owner");

    for (const call of db.supportTicket.update.mock.calls) {
      expect(call[0].data).not.toHaveProperty("studioId");
      expect(call[0].data).not.toHaveProperty("userId");
    }
  });
});

/* ═══════════════════════════════════════════════════════════ admin ═══ */

describe("admin", () => {
  it("sees every ticket, unfiltered by tenant", async () => {
    const { listAllTickets } = await import("@/server/services/support");
    await listAllTickets();

    const w = db.supportTicket.findMany.mock.calls[0][0].where;
    expect(w.studioId, "an admin is not a tenant").toBeUndefined();
  });

  it("can reply, which moves the ticket to waiting-for-planner", async () => {
    const { replyAsAdmin } = await import("@/server/services/support");
    await replyAsAdmin("t1", "Platform Owner", "Open Guests from the wedding dashboard.");

    const msg = db.ticketMessage.create.mock.calls[0][0].data;
    expect(msg.authorType).toBe("ADMIN");
    expect(msg.authorName).toBe("Platform Owner");

    const data = db.supportTicket.update.mock.calls[0][0].data;
    expect(data.status).toBe("WAITING_FOR_PLANNER");
    expect(data.firstReplyAt, "the first response time is recorded once").toBeInstanceOf(Date);
  });

  it("does not overwrite the first response time on a later reply", async () => {
    db.supportTicket.findUnique.mockResolvedValue({ ...TICKET, firstReplyAt: new Date("2026-01-01") });
    const { replyAsAdmin } = await import("@/server/services/support");
    await replyAsAdmin("t1", "Platform Owner", "Following up.");

    expect(db.supportTicket.update.mock.calls[0][0].data).not.toHaveProperty("firstReplyAt");
  });

  it("emails the planner a link, never the reply body", async () => {
    const { emails } = await import("@/lib/email");
    const { replyAsAdmin } = await import("@/server/services/support");
    const secret = "Here is the internal note nobody outside should read.";
    await replyAsAdmin("t1", "Platform Owner", secret);

    const sent = (emails.supportTicketReply as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(sent.to).toBe("a@example.com");
    expect(sent.link).toContain("/studio/help/tickets/t1");
    expect(
      JSON.stringify(sent),
      "the reply stays in the product; email carries a link",
    ).not.toContain(secret);
  });

  it("can change status and priority", async () => {
    const s = await import("@/server/services/support");
    await s.setTicketStatus("t1", "IN_PROGRESS", "Platform Owner");
    expect(db.supportTicket.update.mock.calls[0][0].data.status).toBe("IN_PROGRESS");

    vi.clearAllMocks();
    db.supportTicket.update.mockResolvedValue(TICKET);
    await s.setTicketPriority("t1", "URGENT", "Platform Owner");
    expect(db.supportTicket.update.mock.calls[0][0].data.priority).toBe("URGENT");
  });

  it("stamps resolvedAt when settling and clears it when reopening", async () => {
    const s = await import("@/server/services/support");
    await s.setTicketStatus("t1", "RESOLVED", "Platform Owner");
    expect(db.supportTicket.update.mock.calls[0][0].data.resolvedAt).toBeInstanceOf(Date);

    vi.clearAllMocks();
    db.supportTicket.update.mockResolvedValue(TICKET);
    await s.setTicketStatus("t1", "OPEN", "Platform Owner");
    expect(db.supportTicket.update.mock.calls[0][0].data.resolvedAt).toBeNull();
  });
});

/* ═════════════════════════════════════════════════════════ throttle ═══ */

describe("ticket creation is bounded", () => {
  it("refuses once the per-studio hourly limit is spent", async () => {
    rateLimit.mockResolvedValue(false);
    const { createTicket } = await import("@/server/services/support");

    await expect(
      createTicket("studio-a", "u1", "Planner A", {
        subject: "Another one",
        category: "OTHER",
        body: "This body is long enough to pass validation.",
      }),
    ).rejects.toThrow();
    expect(db.supportTicket.create, "nothing may be written once throttled").not.toHaveBeenCalled();
  });

  it("keys the limit on the studio, not on anything a client sends", async () => {
    const { createTicket } = await import("@/server/services/support");
    await createTicket("studio-a", "u1", "Planner A", {
      subject: "A question",
      category: "OTHER",
      body: "This body is long enough to pass validation.",
    });

    expect(rateLimit.mock.calls[0][0]).toBe("support:studio-a");
  });
});
