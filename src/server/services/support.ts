import "server-only";
import { prisma } from "@/lib/db";
import { emails } from "@/lib/email";
import { rateLimit } from "@/lib/ratelimit";
import { UserError } from "@/lib/errors";
import { logAudit } from "./audit";
import type { TicketStatus, TicketPriority, TicketCategory } from "@prisma/client";

/**
 * Support tickets, split down the middle by who is asking.
 *
 * Everything in the first half takes `studioId` from the caller's session and
 * puts it in the WHERE clause, exactly like every other service in this
 * codebase. Everything in the second half deliberately does not, because an
 * admin is not a tenant — those functions are reachable only from `/admin`,
 * which `requireAdmin()` gates.
 *
 * The two halves are kept in one file and separated by a banner rather than
 * split across two, because the thing most likely to go wrong here is calling
 * an admin function from a planner page. Having them adjacent makes that
 * visible in review; having them in different files would make it invisible.
 *
 * No function anywhere takes a studio id from anything a client can set. The
 * planner-side functions receive it from `requireStudio()` and the admin-side
 * functions never accept one at all.
 */

/* ═══════════════════════════════════════════════════════════ planner ═══ */

/** A ticket reference short enough to read aloud on a call. */
export const ticketRef = (id: string) => `#${id.slice(-6).toUpperCase()}`;

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  GETTING_STARTED: "Getting started",
  GUESTS_AND_RSVPS: "Guests & RSVPs",
  WEBSITE_AND_DESIGN: "Website & design",
  SCHEDULE_AND_SEATING: "Schedule & seating",
  BILLING: "Billing",
  SOMETHING_BROKEN: "Something is broken",
  OTHER: "Something else",
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  WAITING_FOR_PLANNER: "Waiting for you",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};

/** Open-ended states, for the planner's "still going" tab and the admin queue. */
export const LIVE_STATUSES: TicketStatus[] = ["OPEN", "IN_PROGRESS", "WAITING_FOR_PLANNER"];

/**
 * Where a new-ticket notification goes.
 *
 * The same resolution as the access-request inbox, and for the same reason:
 * `EMAIL_FROM` is formatted `EventOS <hello@example.com>` and passing that whole
 * string as a recipient is rejected by the provider. With neither variable set
 * the ticket is still created; only the nudge is lost.
 */
const OWNER_EMAIL = (() => {
  const explicit = process.env.SUPPORT_TICKET_TO?.trim() ?? process.env.ACCESS_REQUEST_TO?.trim();
  if (explicit) return explicit;
  const from = process.env.EMAIL_FROM ?? "";
  return from.match(/<([^>]+)>/)?.[1] ?? (from.includes("@") ? from.trim() : null);
})();

const appUrl = () => (process.env.APP_URL ?? "").replace(/\/$/, "");

export type NewTicket = {
  subject: string;
  category: TicketCategory;
  body: string;
};

/**
 * Open a ticket.
 *
 * `studioId` and `userId` both come from the session. Neither is accepted from
 * the form, which is what makes it impossible to file a ticket into someone
 * else's studio — there is no parameter through which to try.
 */
export async function createTicket(
  studioId: string,
  userId: string,
  actorName: string,
  input: NewTicket,
) {
  /**
   * A ceiling on ticket creation.
   *
   * Not because a flood of tickets is dangerous — it grants nothing and costs
   * only storage — but because each one sends an email from our domain, and a
   * stuck form is the usual way that happens. Ten an hour is far past any real
   * support need and far short of a loop.
   */
  if (!(await rateLimit(`support:${studioId}`, 10, 60 * 60 * 1000))) {
    throw new UserError(
      "That is a lot of tickets at once. If something is urgent, reply on an existing one and we will see it.",
    );
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      studioId,
      userId,
      subject: input.subject,
      category: input.category,
      // The opening message is part of the same write: a ticket with no
      // message is a row that reads as a bug to whoever picks it up.
      messages: {
        create: { authorType: "PLANNER", authorName: actorName, body: input.body },
      },
    },
    include: { studio: { select: { name: true } }, user: { select: { email: true } } },
  });

  await logAudit({
    actorType: "PLANNER",
    actorName,
    studioId,
    targetId: ticket.id,
    action: `Opened support ticket ${ticketRef(ticket.id)} — ${input.subject}`,
  });

  // Best effort, and deliberately not allowed to fail the request: the ticket
  // is already saved, so a mail outage must not tell the planner it was not.
  if (OWNER_EMAIL) {
    await Promise.allSettled([
      emails.supportTicketOpened({
        to: OWNER_EMAIL,
        ref: ticketRef(ticket.id),
        studio: ticket.studio.name,
        from: actorName,
        replyTo: ticket.user.email,
        subject: input.subject,
        category: CATEGORY_LABELS[input.category],
        body: input.body,
        link: `${appUrl()}/admin/support/${ticket.id}`,
      }),
    ]);
  }

  return ticket;
}

/** Every ticket belonging to the caller's studio. Never anyone else's. */
export function listMyTickets(studioId: string) {
  return prisma.supportTicket.findMany({
    where: { studioId },
    orderBy: { lastMessageAt: "desc" },
    include: { _count: { select: { messages: true } } },
    take: 200,
  });
}

/**
 * One ticket, if it belongs to the caller's studio.
 *
 * `findFirst` with both columns rather than `findUnique` on the id followed by
 * a check: the tenancy condition and the lookup are one statement, so there is
 * no branch in which a foreign ticket has been loaded into memory and the guard
 * is the only thing standing between it and the response.
 *
 * Returns null rather than throwing, so the page can answer 404. A foreign
 * ticket and a deleted ticket must be indistinguishable from outside.
 */
export function getMyTicket(studioId: string, ticketId: string) {
  return prisma.supportTicket.findFirst({
    where: { id: ticketId, studioId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
}

/**
 * Add the planner's reply to their own ticket.
 *
 * The ownership check is the `updateMany` at the end: it carries `studioId`, so
 * a planner naming another studio's ticket updates zero rows and is told the
 * ticket does not exist. The message insert is guarded by the same read.
 */
export async function replyAsPlanner(
  studioId: string,
  ticketId: string,
  actorName: string,
  body: string,
) {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, studioId },
    select: { id: true, status: true },
  });
  if (!ticket) throw new UserError("That ticket no longer exists.");

  /**
   * Replying to something already put to bed reopens it.
   *
   * A planner who answers a resolved ticket is telling us it was not resolved.
   * Leaving it closed would drop that on the floor — it would sit in a state
   * nobody is looking at, which is the worst outcome available.
   */
  const status: TicketStatus =
    ticket.status === "RESOLVED" || ticket.status === "CLOSED" ? "OPEN" : "IN_PROGRESS";

  const now = new Date();
  await prisma.$transaction([
    prisma.ticketMessage.create({
      data: { ticketId: ticket.id, authorType: "PLANNER", authorName: actorName, body },
    }),
    prisma.supportTicket.updateMany({
      where: { id: ticket.id, studioId },
      data: { status, lastMessageAt: now, resolvedAt: null },
    }),
  ]);
}

/* ═════════════════════════════════════════════════════════════ admin ═══
 *
 * Everything below is reachable only from `/admin`, which `requireAdmin()`
 * gates. These functions take no studio id — an admin's view is the whole
 * queue, and giving them a tenant parameter would invite a caller to pass one
 * from a request.
 */

export type AdminTicketFilter = { status?: TicketStatus; q?: string };

export function listAllTickets(filter: AdminTicketFilter = {}) {
  return prisma.supportTicket.findMany({
    where: {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.q
        ? {
            OR: [
              { subject: { contains: filter.q, mode: "insensitive" as const } },
              { studio: { name: { contains: filter.q, mode: "insensitive" as const } } },
              { user: { email: { contains: filter.q, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    },
    // A work queue, not a log: anything still live sorts ahead of anything
    // settled, and within that the oldest waits longest.
    orderBy: [{ status: "asc" }, { lastMessageAt: "desc" }],
    include: {
      studio: { select: { id: true, name: true } },
      user: { select: { name: true, email: true } },
      _count: { select: { messages: true } },
    },
    take: 200,
  });
}

export function getTicketForAdmin(ticketId: string) {
  return prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      studio: { select: { id: true, name: true, status: true } },
      user: { select: { name: true, email: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
}

export function ticketCounts() {
  return prisma.supportTicket.groupBy({ by: ["status"], _count: { _all: true } });
}

/**
 * The admin's reply.
 *
 * Moves the ticket to WAITING_FOR_PLANNER, which is the honest description of
 * where it now sits and keeps it out of the queue of things needing our
 * attention without pretending it is finished.
 */
export async function replyAsAdmin(ticketId: string, actorName: string, body: string) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: { user: { select: { email: true, name: true } }, studio: { select: { name: true } } },
  });
  if (!ticket) throw new UserError("That ticket no longer exists.");

  const now = new Date();
  await prisma.$transaction([
    prisma.ticketMessage.create({
      data: { ticketId, authorType: "ADMIN", authorName: actorName, body },
    }),
    prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: "WAITING_FOR_PLANNER",
        lastMessageAt: now,
        // Only the first one, so response time stays measurable.
        ...(ticket.firstReplyAt ? {} : { firstReplyAt: now }),
      },
    }),
  ]);

  await logAudit({
    actorType: "ADMIN",
    actorName,
    studioId: ticket.studioId,
    targetId: ticket.id,
    action: `Replied to support ticket ${ticketRef(ticket.id)}`,
  });

  /**
   * The planner is told there is a reply, not what it says.
   *
   * The message body stays inside the product. An email is forwarded, quoted
   * and left open on shared screens, and a support thread can contain a
   * planner's own account details. The notification carries the subject and a
   * link; reading it requires their session.
   */
  if (ticket.user.email) {
    await Promise.allSettled([
      emails.supportTicketReply({
        to: ticket.user.email,
        name: ticket.user.name,
        ref: ticketRef(ticket.id),
        subject: ticket.subject,
        link: `${appUrl()}/studio/help/tickets/${ticket.id}`,
      }),
    ]);
  }
}

export async function setTicketStatus(ticketId: string, status: TicketStatus, actorName: string) {
  const ticket = await prisma.supportTicket.update({
    where: { id: ticketId },
    data: {
      status,
      resolvedAt: status === "RESOLVED" || status === "CLOSED" ? new Date() : null,
    },
  });
  await logAudit({
    actorType: "ADMIN", actorName, studioId: ticket.studioId, targetId: ticket.id,
    action: `Set support ticket ${ticketRef(ticket.id)} to ${STATUS_LABELS[status]}`,
  });
}

export async function setTicketPriority(
  ticketId: string,
  priority: TicketPriority,
  actorName: string,
) {
  const ticket = await prisma.supportTicket.update({ where: { id: ticketId }, data: { priority } });
  await logAudit({
    actorType: "ADMIN", actorName, studioId: ticket.studioId, targetId: ticket.id,
    action: `Set support ticket ${ticketRef(ticket.id)} priority to ${PRIORITY_LABELS[priority]}`,
  });
}
